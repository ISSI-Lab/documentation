import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { AuthenticatedRequest, optionalAuth, requireAuth } from '../auth';
import { CompilerType, LatexDoc, LatexFolder, LatexProject, LatexTemplate } from '../models';
import { compileLatexProject, bundleLatexProjectZip } from '../latexCompiler';

export const latexRoutes = Router();

// ==============================================================================
// 1. LaTeX Templates API
// ==============================================================================

function formatLatexTemplateRow(row: any): LatexTemplate {
  let templateFiles: any[] = [];
  if (typeof row.template_files === 'string') {
    try {
      templateFiles = JSON.parse(row.template_files);
    } catch {
      templateFiles = [];
    }
  } else if (Array.isArray(row.template_files)) {
    templateFiles = row.template_files;
  }

  let tags: string[] = [];
  if (typeof row.tags === 'string') {
    try {
      tags = JSON.parse(row.tags);
    } catch {
      tags = [];
    }
  } else if (Array.isArray(row.tags)) {
    tags = row.tags;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'Academic',
    compiler: (row.compiler || 'pdflatex') as CompilerType,
    main_file: row.main_file || 'main.tex',
    icon: row.icon || 'file-code-2',
    visibility: row.visibility || 'public',
    organization_id: row.organization_id || null,
    created_by: row.created_by || null,
    tags,
    template_files: templateFiles,
    thumbnail_url: row.thumbnail_url || null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/latex/templates - List accessible LaTeX templates
latexRoutes.get('/latex/templates', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { category, search } = req.query;

    let query = 'SELECT * FROM latex_templates WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      query += ` AND (visibility = 'public' OR created_by = ? OR (organization_id IS NOT NULL AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?)))`;
      params.push(userId, userId);
    } else {
      query += ` AND visibility = 'public'`;
    }

    if (category && typeof category === 'string' && category.trim()) {
      query += ' AND LOWER(category) = LOWER(?)';
      params.push(category.trim());
    }

    if (search && typeof search === 'string' && search.trim()) {
      query += ' AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)';
      const s = `%${search.trim().toLowerCase()}%`;
      params.push(s, s);
    }

    query += ' ORDER BY created_at ASC';

    const [rows] = await pool.query<any[]>(query, params);
    const templates = rows.map(formatLatexTemplateRow);
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX templates', detail: err.message });
  }
});

// GET /api/v1/latex/templates/:id - Get single LaTeX template
latexRoutes.get('/latex/templates/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM latex_templates WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'LaTeX template not found' });
    }
    res.json(formatLatexTemplateRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX template', detail: err.message });
  }
});

// POST /api/v1/latex/templates - Create custom LaTeX template
latexRoutes.post('/latex/templates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, category, compiler, main_file, icon, visibility, organization_id, tags, template_files } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Template title is required' });
    }

    const templateId = `tpl-lx-${crypto.randomUUID()}`;
    const cleanCompiler = ['xelatex', 'lualatex'].includes(compiler) ? compiler : 'pdflatex';
    const cleanMainFile = main_file && main_file.trim() ? main_file.trim() : 'main.tex';
    const cleanFiles = Array.isArray(template_files) && template_files.length > 0
      ? template_files
      : [{ name: 'main.tex', path: 'main.tex', is_main: true, content: '\\documentclass{article}\n\\begin{document}\nHello LaTeX!\n\\end{document}\n' }];

    await pool.query(
      `INSERT INTO latex_templates (id, title, description, category, compiler, main_file, icon, visibility, organization_id, created_by, tags, template_files, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        templateId,
        title.trim(),
        description || '',
        category || 'General',
        cleanCompiler,
        cleanMainFile,
        icon || 'file-code-2',
        visibility || 'public',
        organization_id || null,
        userId,
        JSON.stringify(tags || []),
        JSON.stringify(cleanFiles),
      ]
    );

    const [rows] = await pool.query<any[]>('SELECT * FROM latex_templates WHERE id = ?', [templateId]);
    res.status(201).json(formatLatexTemplateRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create LaTeX template', detail: err.message });
  }
});

// ==============================================================================
// 2. LaTeX Project Workspace & Multi-File Management
// ==============================================================================

// Helper to resolve or create a project row linked to a document
async function ensureLatexProject(documentId: string): Promise<any> {
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM latex_projects WHERE document_id = ? OR id = ?',
    [documentId, documentId]
  );
  if (rows && rows.length > 0) {
    return rows[0];
  }

  // Find document title
  const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [documentId]);
  const docTitle = docRows?.[0]?.title || 'Untitled LaTeX Document';

  const projectId = `proj-${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO latex_projects (id, document_id, name, description, compiler, root_doc_id, active, created_at, updated_at)
     VALUES (?, ?, ?, '', 'pdflatex', NULL, TRUE, NOW(), NOW())`,
    [projectId, documentId, docTitle]
  );

  // Initialize main.tex doc
  const mainDocId = `doc-${crypto.randomUUID()}`;
  const defaultContent = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{${docTitle}}
\\author{Author}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Welcome to your new LaTeX document in DocForge.

\\begin{equation}
E = mc^2
\\end{equation}

\\end{document}
`;

  await pool.query(
    `INSERT INTO latex_docs (id, project_id, folder_id, name, path, content, rev, version, created_at, updated_at)
     VALUES (?, ?, NULL, 'main.tex', 'main.tex', ?, 0, 1, NOW(), NOW())`,
    [mainDocId, projectId, defaultContent]
  );

  await pool.query(
    'UPDATE latex_projects SET root_doc_id = ? WHERE id = ?',
    [mainDocId, projectId]
  );

  const [createdRows] = await pool.query<any[]>('SELECT * FROM latex_projects WHERE id = ?', [projectId]);
  return createdRows[0];
}

// GET /api/v1/documents/:id/latex - Load complete LaTeX project workspace data
latexRoutes.get('/documents/:id/latex', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);

    const [folders] = await pool.query<any[]>(
      'SELECT id, project_id, parent_folder_id, name, path, created_at, updated_at FROM latex_folders WHERE project_id = ? ORDER BY path ASC',
      [project.id]
    );

    const [docs] = await pool.query<any[]>(
      'SELECT id, project_id, folder_id, name, path, content, rev, version, created_at, updated_at FROM latex_docs WHERE project_id = ? ORDER BY name ASC',
      [project.id]
    );

    const [files] = await pool.query<any[]>(
      'SELECT id, project_id, folder_id, name, path, size, mime_type, created_at, updated_at FROM latex_files WHERE project_id = ? ORDER BY name ASC',
      [project.id]
    );

    const [compilations] = await pool.query<any[]>(
      'SELECT id, project_id, status, compiler, logs, errors, pdf_size, created_at FROM latex_compilations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [project.id]
    );

    let latestCompilation = null;
    if (compilations && compilations.length > 0) {
      const c = compilations[0];
      let parsedErrors = [];
      if (typeof c.errors === 'string') {
        try {
          parsedErrors = JSON.parse(c.errors);
        } catch {
          parsedErrors = [];
        }
      } else if (Array.isArray(c.errors)) {
        parsedErrors = c.errors;
      }
      latestCompilation = {
        ...c,
        errors: parsedErrors,
        pdf_url: `/api/v1/documents/${documentId}/latex/pdf`,
      };
    }

    // Determine root document
    const rootDoc = docs.find((d) => d.id === project.root_doc_id) || docs.find((d) => d.name === 'main.tex') || docs[0] || null;

    res.json({
      project: {
        ...project,
        root_doc_id: rootDoc?.id || null,
      },
      folders,
      docs: docs.map((d) => ({
        ...d,
        is_main: d.id === rootDoc?.id,
      })),
      files,
      main_doc: rootDoc,
      latest_compilation: latestCompilation,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX workspace data', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/doc - Create a new text file (.tex, .bib, etc.)
latexRoutes.post('/documents/:id/latex/doc', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { name, folder_id, content } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'File name is required' });
    }

    const cleanName = name.trim();
    let folderPath = '';
    if (folder_id) {
      const [fRows] = await pool.query<any[]>('SELECT path FROM latex_folders WHERE id = ? AND project_id = ?', [folder_id, project.id]);
      if (fRows && fRows.length > 0) {
        folderPath = fRows[0].path;
      }
    }

    const filePath = folderPath ? `${folderPath}/${cleanName}` : cleanName;
    const docId = `doc-${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO latex_docs (id, project_id, folder_id, name, path, content, rev, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, NOW(), NOW())`,
      [docId, project.id, folder_id || null, cleanName, filePath, content || '']
    );

    const [rows] = await pool.query<any[]>('SELECT * FROM latex_docs WHERE id = ?', [docId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create document', detail: err.message });
  }
});

// PUT /api/v1/documents/:id/latex/doc/:docId - Update text doc content
latexRoutes.put('/documents/:id/latex/doc/:docId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, name } = req.body;
    const docId = req.params.docId;

    if (content !== undefined) {
      await pool.query(
        `UPDATE latex_docs 
         SET content = ?, rev = rev + 1, updated_at = NOW() 
         WHERE id = ?`,
        [content, docId]
      );
    }

    if (name && name.trim()) {
      await pool.query(
        `UPDATE latex_docs SET name = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), docId]
      );
    }

    const [rows] = await pool.query<any[]>('SELECT * FROM latex_docs WHERE id = ?', [docId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update document', detail: err.message });
  }
});

// DELETE /api/v1/documents/:id/latex/doc/:docId - Delete a text document
latexRoutes.delete('/documents/:id/latex/doc/:docId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const docId = req.params.docId;
    await pool.query('DELETE FROM latex_docs WHERE id = ?', [docId]);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete document', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/folder - Create a folder
latexRoutes.post('/documents/:id/latex/folder', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { name, parent_folder_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const cleanName = name.trim();
    let parentPath = '';
    if (parent_folder_id) {
      const [pRows] = await pool.query<any[]>('SELECT path FROM latex_folders WHERE id = ? AND project_id = ?', [parent_folder_id, project.id]);
      if (pRows && pRows.length > 0) {
        parentPath = pRows[0].path;
      }
    }

    const folderPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;
    const folderId = `fld-${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO latex_folders (id, project_id, parent_folder_id, name, path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [folderId, project.id, parent_folder_id || null, cleanName, folderPath]
    );

    const [rows] = await pool.query<any[]>('SELECT * FROM latex_folders WHERE id = ?', [folderId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create folder', detail: err.message });
  }
});

// DELETE /api/v1/documents/:id/latex/folder/:folderId - Delete a folder and its contents
latexRoutes.delete('/documents/:id/latex/folder/:folderId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.params.folderId;
    await pool.query('DELETE FROM latex_docs WHERE folder_id = ?', [folderId]);
    await pool.query('DELETE FROM latex_files WHERE folder_id = ?', [folderId]);
    await pool.query('DELETE FROM latex_folders WHERE id = ? OR parent_folder_id = ?', [folderId, folderId]);
    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete folder', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/upload - Upload a binary asset (image, figure, etc.)
latexRoutes.post('/documents/:id/latex/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { name, folder_id, data_base64, mime_type } = req.body;

    if (!name || !name.trim() || !data_base64) {
      return res.status(400).json({ error: 'File name and base64 data are required' });
    }

    const cleanName = name.trim();
    let folderPath = '';
    if (folder_id) {
      const [fRows] = await pool.query<any[]>('SELECT path FROM latex_folders WHERE id = ? AND project_id = ?', [folder_id, project.id]);
      if (fRows && fRows.length > 0) {
        folderPath = fRows[0].path;
      }
    }

    const filePath = folderPath ? `${folderPath}/${cleanName}` : cleanName;
    const buffer = Buffer.from(data_base64, 'base64');
    const fileId = `file-${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO latex_files (id, project_id, folder_id, name, path, size, mime_type, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [fileId, project.id, folder_id || null, cleanName, filePath, buffer.length, mime_type || 'application/octet-stream', buffer]
    );

    res.status(201).json({
      id: fileId,
      name: cleanName,
      path: filePath,
      size: buffer.length,
      mime_type: mime_type || 'application/octet-stream',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to upload asset', detail: err.message });
  }
});

// DELETE /api/v1/documents/:id/latex/file/:fileId - Delete a binary asset
latexRoutes.delete('/documents/:id/latex/file/:fileId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM latex_files WHERE id = ?', [req.params.fileId]);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete file', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/rename - Rename a document, file, or folder
latexRoutes.post('/documents/:id/latex/rename', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entity_id, entity_type, new_name } = req.body;
    if (!entity_id || !new_name || !new_name.trim()) {
      return res.status(400).json({ error: 'Entity ID and new name are required' });
    }

    const cleanName = new_name.trim();

    if (entity_type === 'doc') {
      await pool.query('UPDATE latex_docs SET name = ?, updated_at = NOW() WHERE id = ?', [cleanName, entity_id]);
    } else if (entity_type === 'file') {
      await pool.query('UPDATE latex_files SET name = ?, updated_at = NOW() WHERE id = ?', [cleanName, entity_id]);
    } else if (entity_type === 'folder') {
      await pool.query('UPDATE latex_folders SET name = ?, updated_at = NOW() WHERE id = ?', [cleanName, entity_id]);
    }

    res.json({ success: true, name: cleanName });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to rename entity', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/root-doc - Set primary entry file (e.g. main.tex)
latexRoutes.post('/documents/:id/latex/root-doc', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { doc_id } = req.body;

    if (!doc_id) {
      return res.status(400).json({ error: 'doc_id is required' });
    }

    await pool.query('UPDATE latex_projects SET root_doc_id = ? WHERE id = ?', [doc_id, project.id]);
    res.json({ success: true, root_doc_id: doc_id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to set root document', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/compiler - Update compiler engine
latexRoutes.post('/documents/:id/latex/compiler', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { compiler } = req.body;

    const cleanCompiler = ['xelatex', 'lualatex'].includes(compiler) ? compiler : 'pdflatex';
    await pool.query('UPDATE latex_projects SET compiler = ? WHERE id = ?', [cleanCompiler, project.id]);

    res.json({ success: true, compiler: cleanCompiler });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update compiler', detail: err.message });
  }
});

// ==============================================================================
// 3. LaTeX Compilation & PDF Output APIs
// ==============================================================================

// POST /api/v1/documents/:id/latex/compile - Compile LaTeX project
latexRoutes.post('/documents/:id/latex/compile', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { compiler, main_file } = req.body;

    const result = await compileLatexProject(project.id, compiler, main_file);

    res.json({
      success: result.success,
      compilation_id: result.compilationId,
      status: result.success ? 'success' : 'error',
      logs: result.logs,
      errors: result.errors,
      has_pdf: result.success,
      pdf_url: result.success ? `/api/v1/documents/${documentId}/latex/pdf?t=${Date.now()}` : null,
      pdf_size: result.pdfSize || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Compilation failed', detail: err.message });
  }
});

// GET /api/v1/documents/:id/latex/pdf - Stream latest compiled PDF
latexRoutes.get('/documents/:id/latex/pdf', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);

    const [rows] = await pool.query<any[]>(
      `SELECT pdf_data, pdf_size FROM latex_compilations 
       WHERE project_id = ? AND status = 'success' AND pdf_data IS NOT NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [project.id]
    );

    if (!rows || rows.length === 0 || !rows[0].pdf_data) {
      return res.status(404).json({ error: 'No compiled PDF available for this document' });
    }

    const pdfBuffer: Buffer = rows[0].pdf_data;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${project.name || 'document'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve PDF', detail: err.message });
  }
});

// GET /api/v1/documents/:id/latex/logs - Get latest compilation logs & errors
latexRoutes.get('/documents/:id/latex/logs', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);

    const [rows] = await pool.query<any[]>(
      'SELECT id, status, compiler, logs, errors, created_at FROM latex_compilations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [project.id]
    );

    if (!rows || rows.length === 0) {
      return res.json({ logs: 'No compilation history found.', errors: [] });
    }

    const c = rows[0];
    let parsedErrors = [];
    if (typeof c.errors === 'string') {
      try {
        parsedErrors = JSON.parse(c.errors);
      } catch {
        parsedErrors = [];
      }
    } else if (Array.isArray(c.errors)) {
      parsedErrors = c.errors;
    }

    res.json({
      status: c.status,
      compiler: c.compiler,
      logs: c.logs || '',
      errors: parsedErrors,
      created_at: c.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve logs', detail: err.message });
  }
});

// GET /api/v1/documents/:id/latex/export/zip - Export project as downloadable .zip
latexRoutes.get('/documents/:id/latex/export/zip', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);

    const zipBuffer = await bundleLatexProjectZip(project.id);
    const safeName = (project.name || 'latex-project').replace(/[^a-zA-Z0-9_\-]/g, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to bundle project ZIP', detail: err.message });
  }
});
