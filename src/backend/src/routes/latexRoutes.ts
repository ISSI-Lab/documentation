import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool, seedDefaultLatexTemplates } from '../db';
import {
  AuthenticatedRequest,
  isOrganizationCreator,
  isOrganizationManager,
  isOrganizationMember,
  optionalAuth,
  requireAuth,
} from '../auth';
import { CompilerType, LatexDoc, LatexFolder, LatexProject, LatexTemplate, TemplateVisibility } from '../models';
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

  const orgId = row.organization_id || row.team_id || null;

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'Academic',
    compiler: (row.compiler || 'pdflatex') as CompilerType,
    main_file: row.main_file || 'main.tex',
    icon: row.icon || 'file-code-2',
    visibility: (row.visibility as TemplateVisibility) || 'public',
    organization_id: orgId,
    team_id: orgId,
    created_by: row.created_by || null,
    creator_name: row.creator_name || undefined,
    creator_username: row.creator_username || undefined,
    tags,
    template_files: templateFiles,
    thumbnail_url: row.thumbnail_url || null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

function sanitizeLatexTemplateFiles(rawFiles: any, mainFile = 'main.tex'): any[] {
  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    return [
      {
        name: mainFile,
        path: mainFile,
        is_main: true,
        content: '\\documentclass{article}\n\\begin{document}\nHello LaTeX!\n\\end{document}\n',
      },
    ];
  }
  let hasMain = false;
  const cleaned = rawFiles
    .filter((f: any) => f && (f.name || f.path))
    .map((f: any, idx: number) => {
      const name = String(f.name || f.path || `file_${idx + 1}.tex`).trim();
      const path = String(f.path || name).trim();
      const isMain = Boolean(f.is_main || name === mainFile || path === mainFile);
      if (isMain) hasMain = true;
      return {
        name,
        path,
        is_main: isMain,
        content: f.content !== undefined ? String(f.content) : '',
        ...(f.folder ? { folder: String(f.folder).trim() } : {}),
      };
    });
  if (cleaned.length > 0 && !hasMain) {
    cleaned[0].is_main = true;
  }
  return cleaned;
}

// GET /api/v1/latex/templates - List accessible LaTeX templates
latexRoutes.get('/latex/templates', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { organization_id, team_id, visibility, category, tag, search, scope } = req.query;
    const targetOrgId = (organization_id || team_id) as string | undefined;

    let query = `
      SELECT lt.*, u.name as creator_name, u.username as creator_username
      FROM latex_templates lt
      LEFT JOIN users u ON lt.created_by = u.id
      WHERE
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      // Authenticated: can see public templates OR their own personal templates OR private templates of organizations they belong to
      conditions.push(
        `(lt.visibility = 'public' OR lt.created_by = ? OR (lt.organization_id IS NOT NULL AND lt.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?)))`
      );
      params.push(userId, userId);
    } else {
      // Unauthenticated: strictly public templates only
      conditions.push(`lt.visibility = 'public'`);
    }

    if (scope === 'personal' || targetOrgId === 'personal' || targetOrgId === 'null') {
      if (userId) {
        conditions.push('lt.created_by = ? AND lt.organization_id IS NULL');
        params.push(userId);
      }
    } else if (targetOrgId && typeof targetOrgId === 'string') {
      conditions.push('lt.organization_id = ?');
      params.push(targetOrgId);
    }

    if (visibility && (visibility === 'public' || visibility === 'private')) {
      conditions.push('lt.visibility = ?');
      params.push(visibility);
    }

    if (category && typeof category === 'string' && category.trim()) {
      conditions.push('LOWER(lt.category) = LOWER(?)');
      params.push(category.trim());
    }

    if (search && typeof search === 'string' && search.trim()) {
      conditions.push('(LOWER(lt.title) LIKE ? OR LOWER(lt.description) LIKE ? OR LOWER(lt.category) LIKE ?)');
      const s = `%${search.trim().toLowerCase()}%`;
      params.push(s, s, s);
    }

    query += ' ' + conditions.join(' AND ') + ' ORDER BY lt.created_at ASC';

    const [rows] = await pool.query<any[]>(query, params);
    let templates = rows.map(formatLatexTemplateRow);

    if (tag && typeof tag === 'string' && tag.trim()) {
      const targetTag = tag.trim().toLowerCase();
      templates = templates.filter((t) => t.tags && t.tags.some((tagItem) => tagItem.toLowerCase() === targetTag));
    }

    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX templates', detail: err.message });
  }
});

// GET /api/v1/latex/templates/:id - Get single LaTeX template
latexRoutes.get('/latex/templates/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT lt.*, u.name as creator_name, u.username as creator_username
       FROM latex_templates lt
       LEFT JOIN users u ON lt.created_by = u.id
       WHERE lt.id = ?`,
      [req.params.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'LaTeX template not found' });
    }
    const template = formatLatexTemplateRow(rows[0]);
    if (template.visibility === 'private') {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(403).json({ error: 'Private LaTeX templates can only be viewed after signing in' });
      }
      if (template.organization_id) {
        const isMember = await isOrganizationMember(userId, template.organization_id);
        if (!isMember && template.created_by !== userId && req.user?.user_type !== 'organizer') {
          return res.status(403).json({ error: 'You do not have permission to view this private organization LaTeX template' });
        }
      } else if (template.created_by !== userId && req.user?.user_type !== 'organizer') {
        return res.status(403).json({ error: 'You do not have permission to view this private personal LaTeX template' });
      }
    }
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX template', detail: err.message });
  }
});

// POST /api/v1/latex/templates - Create custom LaTeX template (Personal, Organization, or Public)
latexRoutes.post('/latex/templates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      title,
      description,
      category,
      compiler,
      main_file,
      icon,
      visibility,
      organization_id,
      team_id,
      tags,
      template_files,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Template title is required' });
    }

    const finalVisibility: TemplateVisibility = visibility === 'public' ? 'public' : 'private';
    const rawOrgId = organization_id || team_id;
    const finalOrgId: string | null = finalVisibility === 'private' && rawOrgId ? String(rawOrgId) : null;

    // Permission check (matching Markdown templates):
    if (finalVisibility === 'private') {
      if (finalOrgId) {
        const isManager = await isOrganizationManager(user.id, finalOrgId);
        if (!isManager && user.user_type !== 'organizer') {
          return res.status(403).json({
            error: 'Permission denied: Only organization managers and creators can create LaTeX templates for this organization.',
          });
        }
      }
    } else {
      if (user.user_type !== 'organizer') {
        return res.status(403).json({
          error: 'Permission denied: Only organizers can publish public LaTeX templates.',
        });
      }
    }

    const templateId = `tpl-latex-${crypto.randomBytes(4).toString('hex')}`;
    const cleanCompiler = ['xelatex', 'lualatex'].includes(compiler) ? compiler : 'pdflatex';
    const cleanMainFile = main_file && typeof main_file === 'string' && main_file.trim() ? main_file.trim() : 'main.tex';
    const cleanFiles = sanitizeLatexTemplateFiles(template_files, cleanMainFile);
    const resolvedMainFile = cleanFiles.find((f) => f.is_main)?.name || cleanMainFile;
    const cleanTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];

    await pool.query(
      `INSERT INTO latex_templates (id, title, description, category, compiler, main_file, icon, visibility, organization_id, created_by, tags, template_files, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        templateId,
        title.trim(),
        description || '',
        category || 'Academic',
        cleanCompiler,
        resolvedMainFile,
        icon || 'file-code-2',
        finalVisibility,
        finalOrgId,
        user.id,
        JSON.stringify(cleanTags),
        JSON.stringify(cleanFiles),
      ]
    );

    const [rows] = await pool.query<any[]>(
      `SELECT lt.*, u.name as creator_name, u.username as creator_username
       FROM latex_templates lt
       LEFT JOIN users u ON lt.created_by = u.id
       WHERE lt.id = ?`,
      [templateId]
    );
    res.status(201).json(formatLatexTemplateRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create LaTeX template', detail: err.message });
  }
});

// PUT /api/v1/latex/templates/:id - Update custom LaTeX template
latexRoutes.put('/latex/templates/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const [existing] = await pool.query<any[]>('SELECT * FROM latex_templates WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'LaTeX template not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;

    if (currentOrgId) {
      const isManager = await isOrganizationManager(user.id, currentOrgId);
      if (!isManager && current.created_by !== user.id && user.user_type !== 'organizer') {
        return res.status(403).json({ error: 'Only organization managers can edit this organization LaTeX template' });
      }
    } else if (current.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({ error: 'Only the creator or an organizer can edit this LaTeX template' });
    }

    const {
      title,
      description,
      category,
      compiler,
      main_file,
      icon,
      visibility,
      organization_id,
      team_id,
      tags,
      template_files,
    } = req.body;

    const newVisibility: TemplateVisibility =
      visibility !== undefined ? (visibility === 'public' ? 'public' : 'private') : current.visibility;
    if (newVisibility === 'public' && current.visibility !== 'public' && user.user_type !== 'organizer') {
      return res.status(403).json({ error: 'Permission denied: Only organizers can publish public LaTeX templates.' });
    }

    let newOrgId = current.organization_id;
    if (newVisibility === 'public') {
      newOrgId = null;
    } else if (organization_id !== undefined || team_id !== undefined) {
      const rawOrg = organization_id !== undefined ? organization_id : team_id;
      newOrgId = rawOrg ? String(rawOrg) : null;
    }

    const newCompiler =
      compiler !== undefined
        ? ['xelatex', 'lualatex'].includes(compiler)
          ? compiler
          : 'pdflatex'
        : current.compiler;
    const newMainFile =
      main_file !== undefined && String(main_file).trim() ? String(main_file).trim() : current.main_file || 'main.tex';

    let filesJson = current.template_files;
    let resolvedMainFile = newMainFile;
    if (template_files !== undefined) {
      const cleanFiles = sanitizeLatexTemplateFiles(template_files, newMainFile);
      resolvedMainFile = cleanFiles.find((f) => f.is_main)?.name || newMainFile;
      filesJson = JSON.stringify(cleanFiles);
    } else if (typeof filesJson !== 'string') {
      filesJson = JSON.stringify(filesJson || []);
    }

    let tagsJson = current.tags;
    if (tags !== undefined) {
      const cleanTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
      tagsJson = JSON.stringify(cleanTags);
    } else if (typeof tagsJson !== 'string') {
      tagsJson = JSON.stringify(tagsJson || []);
    }

    await pool.query(
      `UPDATE latex_templates
       SET title = ?, description = ?, category = ?, compiler = ?, main_file = ?, icon = ?, visibility = ?, organization_id = ?, tags = ?, template_files = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title !== undefined ? String(title).trim() : current.title,
        description !== undefined ? description : current.description,
        category !== undefined ? category : current.category,
        newCompiler,
        resolvedMainFile,
        icon !== undefined ? icon : current.icon,
        newVisibility,
        newOrgId,
        tagsJson,
        filesJson,
        id,
      ]
    );

    const [updatedRows] = await pool.query<any[]>(
      `SELECT lt.*, u.name as creator_name, u.username as creator_username
       FROM latex_templates lt
       LEFT JOIN users u ON lt.created_by = u.id
       WHERE lt.id = ?`,
      [id]
    );
    res.json(formatLatexTemplateRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update LaTeX template', detail: err.message });
  }
});

// DELETE /api/v1/latex/templates/:id - Delete LaTeX template
latexRoutes.delete('/latex/templates/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const [existing] = await pool.query<any[]>('SELECT * FROM latex_templates WHERE id = ?', [req.params.id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'LaTeX template not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isManager = await isOrganizationManager(user.id, currentOrgId);
      if (!isManager && current.created_by !== user.id && user.user_type !== 'organizer') {
        return res.status(403).json({ error: 'Only organization managers can delete this LaTeX template' });
      }
    } else if (current.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({ error: 'Only the creator or an organizer can delete this LaTeX template' });
    }

    await pool.query('DELETE FROM latex_templates WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete LaTeX template', detail: err.message });
  }
});

// POST /api/v1/latex/templates/:id/copy - Copy LaTeX template to the creator's other organization
latexRoutes.post('/latex/templates/:id/copy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const [existing] = await pool.query<any[]>('SELECT * FROM latex_templates WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'LaTeX template not found' });
    }

    const sourceTemplate = existing[0];
    const sourceOrgId = sourceTemplate.organization_id || sourceTemplate.team_id || null;

    const rawTargetOrgId = req.body.target_organization_id || req.body.target_team_id;
    if (!rawTargetOrgId || typeof rawTargetOrgId !== 'string' || !rawTargetOrgId.trim()) {
      return res.status(400).json({ error: 'Target organization ID is required' });
    }
    const targetOrgId = rawTargetOrgId.trim();

    if (sourceOrgId && sourceOrgId === targetOrgId) {
      return res.status(400).json({
        error: 'Cannot copy LaTeX template to the same organization. Please select a different organization.',
      });
    }

    const [targetOrgRows] = await pool.query<any[]>('SELECT * FROM organizations WHERE id = ?', [targetOrgId]);
    if (!targetOrgRows || targetOrgRows.length === 0) {
      return res.status(404).json({ error: 'Target organization not found' });
    }

    const isTargetCreator = await isOrganizationCreator(user.id, targetOrgId);
    if (!isTargetCreator && user.user_type !== 'organizer') {
      return res.status(403).json({
        error: 'Permission denied: You can only copy templates to organizations where you are the creator.',
      });
    }

    if (sourceOrgId) {
      const isTemplateCreator = sourceTemplate.created_by === user.id;
      const isSourceOrgCreator = await isOrganizationCreator(user.id, sourceOrgId);
      const isSourceOrgManager = await isOrganizationManager(user.id, sourceOrgId);
      if (!isTemplateCreator && !isSourceOrgCreator && !isSourceOrgManager && user.user_type !== 'organizer') {
        return res.status(403).json({
          error: 'Permission denied: Only the template creator or organization creator can copy this organization LaTeX template.',
        });
      }
    } else if (sourceTemplate.visibility === 'private' && sourceTemplate.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({
        error: 'Permission denied: Only the creator can copy this private LaTeX template.',
      });
    }

    const newId = `tpl-latex-${crypto.randomBytes(4).toString('hex')}`;
    const newTitle =
      req.body.title && typeof req.body.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : sourceTemplate.title;

    let files = [];
    if (typeof sourceTemplate.template_files === 'string') {
      try {
        files = JSON.parse(sourceTemplate.template_files);
      } catch {
        files = [];
      }
    } else if (Array.isArray(sourceTemplate.template_files)) {
      files = sourceTemplate.template_files;
    }
    const cleanFiles = sanitizeLatexTemplateFiles(files, sourceTemplate.main_file || 'main.tex');

    let tags: string[] = [];
    if (typeof sourceTemplate.tags === 'string') {
      try {
        tags = JSON.parse(sourceTemplate.tags);
      } catch {
        tags = [];
      }
    } else if (Array.isArray(sourceTemplate.tags)) {
      tags = sourceTemplate.tags;
    }
    const cleanTags = tags.map((t: any) => String(t).trim()).filter(Boolean);

    await pool.query(
      `INSERT INTO latex_templates (id, title, description, category, compiler, main_file, icon, visibility, organization_id, created_by, tags, template_files, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'private', ?, ?, ?, ?, NOW(), NOW())`,
      [
        newId,
        newTitle,
        sourceTemplate.description || '',
        sourceTemplate.category || 'Academic',
        sourceTemplate.compiler || 'pdflatex',
        sourceTemplate.main_file || 'main.tex',
        sourceTemplate.icon || 'file-code-2',
        targetOrgId,
        user.id,
        JSON.stringify(cleanTags),
        JSON.stringify(cleanFiles),
      ]
    );

    const [createdRows] = await pool.query<any[]>(
      `SELECT lt.*, u.name as creator_name, u.username as creator_username
       FROM latex_templates lt
       LEFT JOIN users u ON lt.created_by = u.id
       WHERE lt.id = ?`,
      [newId]
    );

    res.status(201).json(formatLatexTemplateRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to copy LaTeX template', detail: err.message });
  }
});

// POST /api/v1/latex/templates/actions/reset-seeds - Restore default LaTeX seed templates
latexRoutes.post('/latex/templates/actions/reset-seeds', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await seedDefaultLatexTemplates();
    const [rows] = await pool.query<any[]>(
      `SELECT lt.*, u.name as creator_name, u.username as creator_username
       FROM latex_templates lt
       LEFT JOIN users u ON lt.created_by = u.id
       ORDER BY lt.created_at ASC`
    );
    res.json(rows.map(formatLatexTemplateRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset LaTeX seed templates', detail: err.message });
  }
});

// ==============================================================================
// 2. LaTeX Project Workspace & Multi-File Management
// ==============================================================================

// Helper to resolve or create a project row linked to a document
async function ensureLatexProject(documentId: string): Promise<any> {
  let project: any = null;
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM latex_projects WHERE document_id = ? OR id = ?',
    [documentId, documentId]
  );

  if (rows && rows.length > 0) {
    project = rows[0];
  } else {
    // Find document title
    const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [documentId]);
    const docTitle = docRows?.[0]?.title || 'Untitled LaTeX Document';

    const projectId = `proj-${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO latex_projects (id, document_id, name, description, compiler, root_doc_id, version_tag, active, created_at, updated_at)
       VALUES (?, ?, ?, '', 'pdflatex', NULL, '0', TRUE, NOW(), NOW())`,
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
    project = createdRows[0];
  }

  // Ensure initial snapshot 0 exists for this project if snapshots table is empty
  const [snapshotCount] = await pool.query<any[]>(
    'SELECT COUNT(*) as cnt FROM latex_doc_snapshots WHERE project_id = ?',
    [project.id]
  );
  if (!snapshotCount?.[0]?.cnt || Number(snapshotCount[0].cnt) === 0) {
    const [docs] = await pool.query<any[]>('SELECT * FROM latex_docs WHERE project_id = ?', [project.id]);
    const [folders] = await pool.query<any[]>('SELECT * FROM latex_folders WHERE project_id = ?', [project.id]);
    const [files] = await pool.query<any[]>('SELECT * FROM latex_files WHERE project_id = ?', [project.id]);
    const rootDoc = docs.find((d) => d.id === project.root_doc_id) || docs.find((d) => d.name === 'main.tex') || docs[0] || null;

    const snapshotPayload = {
      compiler: project.compiler || 'pdflatex',
      root_doc_id: rootDoc?.id || null,
      folders: (folders || []).map((f) => ({ id: f.id, parent_folder_id: f.parent_folder_id || null, name: f.name, path: f.path })),
      docs: (docs || []).map((d) => ({
        id: d.id,
        folder_id: d.folder_id || null,
        name: d.name,
        path: d.path,
        content: d.content || '',
        rev: Number(d.rev || 0),
        version: Number(d.version || 1),
        is_main: d.id === rootDoc?.id,
      })),
      files: (files || []).map((fl) => ({
        id: fl.id,
        folder_id: fl.folder_id || null,
        name: fl.name,
        path: fl.path,
        size: Number(fl.size || 0),
        mime_type: fl.mime_type || 'application/octet-stream',
        data_base64: fl.data ? Buffer.from(fl.data).toString('base64') : null,
      })),
    };

    const snapshot0Id = `ver-${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO latex_doc_snapshots (id, project_id, user_id, user_name, label, version, comment, snapshot_data, created_at)
       VALUES (?, ?, NULL, 'System', '0', 0, 'Initial version 0', ?, NOW())`,
      [snapshot0Id, project.id, JSON.stringify(snapshotPayload)]
    );

    await pool.query(
      'UPDATE latex_projects SET version_tag = ?, current_version_id = ? WHERE id = ?',
      ['0', snapshot0Id, project.id]
    );
    await pool.query(
      'UPDATE documents SET version_tag = ?, current_version_id = ? WHERE id = ?',
      ['0', snapshot0Id, documentId]
    );

    project.version_tag = '0';
    project.current_version_id = snapshot0Id;
  }

  // Ensure documents table and project row have version_tag set
  if (!project.version_tag) {
    project.version_tag = '0';
    await pool.query('UPDATE latex_projects SET version_tag = ? WHERE id = ?', ['0', project.id]);
    await pool.query('UPDATE documents SET version_tag = ? WHERE id = ?', ['0', documentId]);
  }

  return project;
}

// GET /api/v1/documents/:id/latex - Load complete LaTeX project workspace data
latexRoutes.get('/documents/:id/latex', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const versionId = req.query.version_id ? String(req.query.version_id).trim() : null;

    const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [documentId]);
    const docRecord = docRows?.[0] || null;

    const currentWorkingTag = docRecord?.version_tag || project.version_tag || '0';
    const currentWorkingVersionId = docRecord?.current_version_id || project.current_version_id || null;

    // Check if user is requesting a specific historical version snapshot (read-only view)
    if (versionId && versionId !== 'working') {
      const [snapRows] = await pool.query<any[]>(
        `SELECT s.*, u.name as creator_name, u.username as creator_username
         FROM latex_doc_snapshots s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.id = ? AND s.project_id = ?`,
        [versionId, project.id]
      );

      if (snapRows && snapRows.length > 0) {
        const snap = snapRows[0];
        const parsed = parseSnapshotJson(snap.snapshot_data);
        const snapshotFolders: any[] = Array.isArray(parsed.folders) ? parsed.folders : [];
        const snapshotDocs: any[] = Array.isArray(parsed.docs) ? parsed.docs : [];
        const snapshotFiles: any[] = Array.isArray(parsed.files) ? parsed.files : [];
        const snapCompiler = parsed.compiler || project.compiler || 'pdflatex';

        const rootDoc =
          snapshotDocs.find((d: any) => d.id === parsed.root_doc_id) ||
          snapshotDocs.find((d: any) => d.is_main) ||
          snapshotDocs.find((d: any) => d.name === 'main.tex') ||
          snapshotDocs[0] ||
          null;

        const isCurrent = Boolean(currentWorkingVersionId && snap.id === currentWorkingVersionId);

        return res.json({
          project: {
            ...project,
            compiler: snapCompiler,
            root_doc_id: rootDoc?.id || null,
            version_tag: snap.label || (snap.version !== undefined ? String(snap.version) : '0'),
            current_version_id: snap.id,
            working_version_tag: currentWorkingTag,
            working_version_id: currentWorkingVersionId,
            is_readonly: true,
            is_current: isCurrent,
            viewing_version: {
              id: snap.id,
              version_tag: snap.label || (snap.version !== undefined ? String(snap.version) : '0'),
              version_number: Number(snap.version ?? 0),
              comment: snap.comment || '',
              user_name: snap.user_name || snap.creator_name || 'Author',
              created_at: snap.created_at,
              is_current: isCurrent,
            },
          },
          folders: snapshotFolders,
          docs: snapshotDocs.map((d: any) => ({
            ...d,
            is_main: d.id === rootDoc?.id,
            is_readonly: true,
          })),
          files: snapshotFiles.map((fl: any) => ({
            ...fl,
            is_readonly: true,
          })),
          main_doc: rootDoc,
          latest_compilation: null,
          is_readonly: true,
          version_tag: snap.label || (snap.version !== undefined ? String(snap.version) : '0'),
          current_version_id: snap.id,
          working_version_tag: currentWorkingTag,
          working_version_id: currentWorkingVersionId,
        });
      }
    }

    // Default: Return current working workspace data
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
        pdf_url: `/api/v1/documents/${documentId}/latex/pdf?compilation_id=${c.id}&t=${Date.now()}`,
      };
    }

    // Determine root document
    const rootDoc = docs.find((d) => d.id === project.root_doc_id) || docs.find((d) => d.name === 'main.tex') || docs[0] || null;

    res.json({
      project: {
        ...project,
        version_tag: currentWorkingTag,
        current_version_id: currentWorkingVersionId,
        working_version_tag: currentWorkingTag,
        working_version_id: currentWorkingVersionId,
        root_doc_id: rootDoc?.id || null,
        is_readonly: false,
        is_current: true,
      },
      folders,
      docs: docs.map((d) => ({
        ...d,
        is_main: d.id === rootDoc?.id,
        is_readonly: false,
      })),
      files,
      main_doc: rootDoc,
      latest_compilation: latestCompilation,
      is_readonly: false,
      version_tag: currentWorkingTag,
      current_version_id: currentWorkingVersionId,
      working_version_tag: currentWorkingTag,
      working_version_id: currentWorkingVersionId,
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
      const [dRows] = await pool.query<any[]>('SELECT folder_id FROM latex_docs WHERE id = ?', [entity_id]);
      let newPath = cleanName;
      if (dRows && dRows.length > 0 && dRows[0].folder_id) {
        const [fRows] = await pool.query<any[]>('SELECT path FROM latex_folders WHERE id = ?', [dRows[0].folder_id]);
        if (fRows && fRows.length > 0) {
          newPath = `${fRows[0].path}/${cleanName}`;
        }
      }
      await pool.query('UPDATE latex_docs SET name = ?, path = ?, updated_at = NOW() WHERE id = ?', [cleanName, newPath, entity_id]);
    } else if (entity_type === 'file') {
      const [flRows] = await pool.query<any[]>('SELECT folder_id FROM latex_files WHERE id = ?', [entity_id]);
      let newPath = cleanName;
      if (flRows && flRows.length > 0 && flRows[0].folder_id) {
        const [fRows] = await pool.query<any[]>('SELECT path FROM latex_folders WHERE id = ?', [flRows[0].folder_id]);
        if (fRows && fRows.length > 0) {
          newPath = `${fRows[0].path}/${cleanName}`;
        }
      }
      await pool.query('UPDATE latex_files SET name = ?, path = ?, updated_at = NOW() WHERE id = ?', [cleanName, newPath, entity_id]);
    } else if (entity_type === 'folder') {
      const [fRows] = await pool.query<any[]>('SELECT parent_folder_id FROM latex_folders WHERE id = ?', [entity_id]);
      let newPath = cleanName;
      if (fRows && fRows.length > 0 && fRows[0].parent_folder_id) {
        const [pRows] = await pool.query<any[]>('SELECT path FROM latex_folders WHERE id = ?', [fRows[0].parent_folder_id]);
        if (pRows && pRows.length > 0) {
          newPath = `${pRows[0].path}/${cleanName}`;
        }
      }
      await pool.query('UPDATE latex_folders SET name = ?, path = ?, updated_at = NOW() WHERE id = ?', [cleanName, newPath, entity_id]);
      const [childDocs] = await pool.query<any[]>('SELECT id, name FROM latex_docs WHERE folder_id = ?', [entity_id]);
      for (const cd of childDocs || []) {
        await pool.query('UPDATE latex_docs SET path = ?, updated_at = NOW() WHERE id = ?', [`${newPath}/${cd.name}`, cd.id]);
      }
      const [childFiles] = await pool.query<any[]>('SELECT id, name FROM latex_files WHERE folder_id = ?', [entity_id]);
      for (const cf of childFiles || []) {
        await pool.query('UPDATE latex_files SET path = ?, updated_at = NOW() WHERE id = ?', [`${newPath}/${cf.name}`, cf.id]);
      }
    }

    res.json({ success: true, name: cleanName });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to rename entity', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/move - Move a document or file into a folder (or root)
latexRoutes.post('/documents/:id/latex/move', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { entity_id, entity_type, target_folder_id } = req.body;

    if (!entity_id || !entity_type) {
      return res.status(400).json({ error: 'entity_id and entity_type are required' });
    }

    let folderPath = '';
    let validFolderId: string | null = null;

    if (target_folder_id && target_folder_id !== 'root') {
      const [fRows] = await pool.query<any[]>(
        'SELECT id, path FROM latex_folders WHERE id = ? AND project_id = ?',
        [target_folder_id, project.id]
      );
      if (!fRows || fRows.length === 0) {
        return res.status(404).json({ error: 'Target folder not found in this project' });
      }
      validFolderId = fRows[0].id;
      folderPath = fRows[0].path;
    }

    if (entity_type === 'doc') {
      const [dRows] = await pool.query<any[]>(
        'SELECT id, name FROM latex_docs WHERE id = ? AND project_id = ?',
        [entity_id, project.id]
      );
      if (!dRows || dRows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      const docName = dRows[0].name;
      const newPath = folderPath ? `${folderPath}/${docName}` : docName;
      await pool.query(
        'UPDATE latex_docs SET folder_id = ?, path = ?, updated_at = NOW() WHERE id = ? AND project_id = ?',
        [validFolderId, newPath, entity_id, project.id]
      );
      return res.json({
        success: true,
        entity_id,
        entity_type: 'doc',
        folder_id: validFolderId,
        path: newPath,
      });
    } else if (entity_type === 'file') {
      const [flRows] = await pool.query<any[]>(
        'SELECT id, name FROM latex_files WHERE id = ? AND project_id = ?',
        [entity_id, project.id]
      );
      if (!flRows || flRows.length === 0) {
        return res.status(404).json({ error: 'File asset not found' });
      }
      const fileName = flRows[0].name;
      const newPath = folderPath ? `${folderPath}/${fileName}` : fileName;
      await pool.query(
        'UPDATE latex_files SET folder_id = ?, path = ?, updated_at = NOW() WHERE id = ? AND project_id = ?',
        [validFolderId, newPath, entity_id, project.id]
      );
      return res.json({
        success: true,
        entity_id,
        entity_type: 'file',
        folder_id: validFolderId,
        path: newPath,
      });
    } else {
      return res.status(400).json({ error: 'Invalid entity_type. Must be "doc" or "file"' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to move entity', detail: err.message });
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

// POST /api/v1/documents/:id/latex/compile - Compile LaTeX project (current working or historical version)
latexRoutes.post('/documents/:id/latex/compile', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const { compiler, main_file, version_id } = req.body;

    let compileOpts: any = undefined;
    let effectiveCompiler = compiler || project.compiler || 'pdflatex';

    // If compiling an older version snapshot
    if (version_id && version_id !== 'working') {
      const [snapRows] = await pool.query<any[]>(
        'SELECT * FROM latex_doc_snapshots WHERE id = ? AND project_id = ?',
        [version_id, project.id]
      );
      if (snapRows && snapRows.length > 0) {
        const parsed = parseSnapshotJson(snapRows[0].snapshot_data);
        compileOpts = {
          customDocs: parsed.docs || [],
          customFiles: parsed.files || [],
        };
        effectiveCompiler = compiler || parsed.compiler || project.compiler || 'pdflatex';
      }
    }

    const result = await compileLatexProject(project.id, effectiveCompiler, main_file, compileOpts);

    res.json({
      success: result.success,
      compilation_id: result.compilationId,
      status: result.success ? 'success' : 'error',
      logs: result.logs,
      errors: result.errors,
      has_pdf: result.success,
      pdf_url: result.success ? `/api/v1/documents/${documentId}/latex/pdf?compilation_id=${result.compilationId}&t=${Date.now()}` : null,
      pdf_size: result.pdfSize || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Compilation failed', detail: err.message });
  }
});

// GET /api/v1/documents/:id/latex/pdf - Stream compiled PDF (optionally by compilation_id)
latexRoutes.get('/documents/:id/latex/pdf', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const compilationId = req.query.compilation_id ? String(req.query.compilation_id) : null;

    let rows: any[] = [];
    if (compilationId) {
      const [cRows] = await pool.query<any[]>(
        'SELECT pdf_data, pdf_size FROM latex_compilations WHERE id = ? AND project_id = ? AND status = "success" AND pdf_data IS NOT NULL',
        [compilationId, project.id]
      );
      rows = cRows;
    }

    if (!rows || rows.length === 0) {
      const [latestRows] = await pool.query<any[]>(
        `SELECT pdf_data, pdf_size FROM latex_compilations 
         WHERE project_id = ? AND status = 'success' AND pdf_data IS NOT NULL 
         ORDER BY created_at DESC LIMIT 1`,
        [project.id]
      );
      rows = latestRows;
    }

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

// GET /api/v1/documents/:id/latex/export/zip - Export project as downloadable .zip (working or historical version)
latexRoutes.get('/documents/:id/latex/export/zip', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);
    const versionId = req.query.version_id ? String(req.query.version_id).trim() : null;

    let zipOpts: any = undefined;
    let versionLabel = '';
    if (versionId && versionId !== 'working') {
      const [snapRows] = await pool.query<any[]>(
        'SELECT * FROM latex_doc_snapshots WHERE id = ? AND project_id = ?',
        [versionId, project.id]
      );
      if (snapRows && snapRows.length > 0) {
        const snap = snapRows[0];
        const parsed = parseSnapshotJson(snap.snapshot_data);
        zipOpts = {
          customDocs: parsed.docs || [],
          customFiles: parsed.files || [],
        };
        versionLabel = `_${snap.label || snap.version || 'v'}`;
      }
    }

    const zipBuffer = await bundleLatexProjectZip(project.id, zipOpts);
    const safeName = `${(project.name || 'latex-project').replace(/[^a-zA-Z0-9_\-]/g, '_')}${versionLabel}`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to bundle project ZIP', detail: err.message });
  }
});

// ==============================================================================
// 4. LaTeX Document Version Control (Commit, List Versions, Inspect, Restore)
// ==============================================================================

function parseSnapshotJson(raw: any): any {
  if (!raw) return { compiler: 'pdflatex', root_doc_id: null, folders: [], docs: [], files: [] };
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { compiler: 'pdflatex', root_doc_id: null, folders: [], docs: [], files: [] };
    }
  }
  return raw;
}

function formatVersionSnapshotRow(row: any, documentId: string, activeVersionId: string | null) {
  const parsed = parseSnapshotJson(row.snapshot_data);
  const sanitizedFiles = Array.isArray(parsed.files)
    ? parsed.files.map((f: any) => ({
        id: f.id,
        folder_id: f.folder_id || null,
        name: f.name,
        path: f.path || f.name,
        size: Number(f.size || 0),
        mime_type: f.mime_type || 'application/octet-stream',
      }))
    : [];

  const versionTag = row.label || (row.version !== undefined ? String(row.version) : '0');

  return {
    id: row.id,
    project_id: row.project_id,
    document_id: documentId,
    version_number: Number(row.version ?? 0),
    version_tag: versionTag,
    label: versionTag,
    comment: row.comment || '',
    user_id: row.user_id || null,
    user_name: row.user_name || row.creator_name || row.creator_username || 'Author',
    is_current: Boolean(activeVersionId && row.id === activeVersionId),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    snapshot: {
      compiler: parsed.compiler || 'pdflatex',
      root_doc_id: parsed.root_doc_id || null,
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
      files: sanitizedFiles,
    },
  };
}

// GET /api/v1/documents/:id/latex/versions - List all committed versions & current workspace state
latexRoutes.get('/documents/:id/latex/versions', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const project = await ensureLatexProject(documentId);

    const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [documentId]);
    const docRecord = docRows?.[0] || null;

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

    const rootDoc = docs.find((d) => d.id === project.root_doc_id) || docs.find((d) => d.name === 'main.tex') || docs[0] || null;

    const [snapshotRows] = await pool.query<any[]>(
      `SELECT s.*, u.name as creator_name, u.username as creator_username
       FROM latex_doc_snapshots s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.project_id = ?
       ORDER BY s.version DESC, s.created_at DESC`,
      [project.id]
    );

    const activeVersionTag = docRecord?.version_tag || project.version_tag || (snapshotRows?.[0]?.label ?? null);
    const activeVersionId = docRecord?.current_version_id || project.current_version_id || (snapshotRows?.[0]?.id ?? null);

    const versions = (snapshotRows || []).map((r) => formatVersionSnapshotRow(r, documentId, activeVersionId));

    res.json({
      document_id: documentId,
      project_id: project.id,
      document_title: docRecord?.title || project.name || 'Untitled LaTeX Document',
      version_tag: activeVersionTag,
      current_version_id: activeVersionId,
      current_workspace: {
        compiler: project.compiler || 'pdflatex',
        root_doc_id: rootDoc?.id || null,
        folders,
        docs: docs.map((d) => ({
          ...d,
          is_main: d.id === rootDoc?.id,
        })),
        files,
      },
      versions,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX versions', detail: err.message });
  }
});

// GET /api/v1/documents/:id/latex/versions/:versionId - Get details for a specific version
latexRoutes.get('/documents/:id/latex/versions/:versionId', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = req.params.id;
    const versionId = req.params.versionId;
    const project = await ensureLatexProject(documentId);

    const [docRows] = await pool.query<any[]>('SELECT version_tag, current_version_id FROM documents WHERE id = ?', [documentId]);
    const activeVersionId = docRows?.[0]?.current_version_id || project.current_version_id || null;

    const [rows] = await pool.query<any[]>(
      `SELECT s.*, u.name as creator_name, u.username as creator_username
       FROM latex_doc_snapshots s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.project_id = ?`,
      [versionId, project.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'LaTeX version snapshot not found' });
    }

    res.json(formatVersionSnapshotRow(rows[0], documentId, activeVersionId));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve LaTeX version', detail: err.message });
  }
});

// POST /api/v1/documents/:id/latex/versions - Commit current working LaTeX state as a named version
async function handleCommitLatexVersion(req: AuthenticatedRequest, res: Response) {
  try {
    const documentId = req.params.id;
    const user = req.user;
    const project = await ensureLatexProject(documentId);

    const rawTag = req.body.version_tag ?? req.body.version ?? req.body.label ?? '';
    const cleanTag = String(rawTag).trim();
    if (!cleanTag) {
      return res.status(400).json({ error: 'Version tag is required' });
    }

    const cleanComment = req.body.comment && typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

    // Capture current folders, docs, and binary files
    const [folders] = await pool.query<any[]>(
      'SELECT id, project_id, parent_folder_id, name, path FROM latex_folders WHERE project_id = ? ORDER BY path ASC',
      [project.id]
    );
    const [docs] = await pool.query<any[]>(
      'SELECT id, project_id, folder_id, name, path, content, rev, version FROM latex_docs WHERE project_id = ? ORDER BY name ASC',
      [project.id]
    );
    const [files] = await pool.query<any[]>(
      'SELECT id, project_id, folder_id, name, path, size, mime_type, data FROM latex_files WHERE project_id = ? ORDER BY name ASC',
      [project.id]
    );

    const rootDoc = docs.find((d) => d.id === project.root_doc_id) || docs.find((d) => d.name === 'main.tex') || docs[0] || null;

    const snapshotPayload = {
      compiler: project.compiler || 'pdflatex',
      root_doc_id: rootDoc?.id || null,
      folders: folders.map((f) => ({
        id: f.id,
        parent_folder_id: f.parent_folder_id || null,
        name: f.name,
        path: f.path,
      })),
      docs: docs.map((d) => ({
        id: d.id,
        folder_id: d.folder_id || null,
        name: d.name,
        path: d.path,
        content: d.content || '',
        rev: Number(d.rev || 0),
        version: Number(d.version || 1),
        is_main: d.id === rootDoc?.id,
      })),
      files: files.map((fl) => ({
        id: fl.id,
        folder_id: fl.folder_id || null,
        name: fl.name,
        path: fl.path,
        size: Number(fl.size || 0),
        mime_type: fl.mime_type || 'application/octet-stream',
        data_base64: fl.data ? Buffer.from(fl.data).toString('base64') : null,
      })),
    };

    const [maxRows] = await pool.query<any[]>(
      'SELECT COALESCE(MAX(version), 0) as max_ver FROM latex_doc_snapshots WHERE project_id = ?',
      [project.id]
    );
    const nextVer = Number(maxRows?.[0]?.max_ver || 0) + 1;
    const snapshotId = `ver-${crypto.randomUUID()}`;
    const userName = user?.name || user?.username || 'Author';

    await pool.query(
      `INSERT INTO latex_doc_snapshots (id, project_id, user_id, user_name, label, version, comment, snapshot_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        snapshotId,
        project.id,
        user?.id || null,
        userName,
        cleanTag,
        nextVer,
        cleanComment || null,
        JSON.stringify(snapshotPayload),
      ]
    );

    await pool.query(
      'UPDATE latex_projects SET version_tag = ?, current_version_id = ?, updated_at = NOW() WHERE id = ?',
      [cleanTag, snapshotId, project.id]
    );
    await pool.query(
      'UPDATE documents SET version_tag = ?, current_version_id = ?, updated_at = NOW() WHERE id = ?',
      [cleanTag, snapshotId, documentId]
    );

    const [createdRows] = await pool.query<any[]>(
      `SELECT s.*, u.name as creator_name, u.username as creator_username
       FROM latex_doc_snapshots s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [snapshotId]
    );

    const formatted = formatVersionSnapshotRow(createdRows[0], documentId, snapshotId);

    return res.status(201).json({
      version: formatted,
      version_tag: cleanTag,
      current_version_id: snapshotId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to commit LaTeX version', detail: err.message });
  }
}

latexRoutes.post('/documents/:id/latex/versions', requireAuth, handleCommitLatexVersion);
latexRoutes.post('/documents/:id/latex/commit', requireAuth, handleCommitLatexVersion);

// POST /api/v1/documents/:id/latex/versions/:versionId/restore - Restore a previous version to be the current working version
async function handleRestoreLatexVersion(req: AuthenticatedRequest, res: Response) {
  try {
    const documentId = req.params.id;
    const versionId = req.params.versionId;
    const project = await ensureLatexProject(documentId);

    const [rows] = await pool.query<any[]>(
      `SELECT s.*, u.name as creator_name, u.username as creator_username
       FROM latex_doc_snapshots s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.project_id = ?`,
      [versionId, project.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Version snapshot not found' });
    }

    const snapshotRow = rows[0];
    const parsed = parseSnapshotJson(snapshotRow.snapshot_data);
    const snapshotFolders: any[] = Array.isArray(parsed.folders) ? parsed.folders : [];
    const snapshotDocs: any[] = Array.isArray(parsed.docs) ? parsed.docs : [];
    const snapshotFiles: any[] = Array.isArray(parsed.files) ? parsed.files : [];
    const restoredCompiler = ['pdflatex', 'xelatex', 'lualatex'].includes(parsed.compiler)
      ? parsed.compiler
      : project.compiler || 'pdflatex';

    // Replace working folders, docs, and files for this project
    await pool.query('DELETE FROM latex_docs WHERE project_id = ?', [project.id]);
    await pool.query('DELETE FROM latex_files WHERE project_id = ?', [project.id]);
    await pool.query('DELETE FROM latex_folders WHERE project_id = ?', [project.id]);

    for (const f of snapshotFolders) {
      const fId = f.id || `fld-${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO latex_folders (id, project_id, parent_folder_id, name, path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [fId, project.id, f.parent_folder_id || null, f.name, f.path || f.name]
      );
    }

    let restoredRootDocId: string | null = null;
    for (const d of snapshotDocs) {
      const dId = d.id || `doc-${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO latex_docs (id, project_id, folder_id, name, path, content, rev, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          dId,
          project.id,
          d.folder_id || null,
          d.name,
          d.path || d.name,
          d.content || '',
          Number(d.rev || 0) + 1,
          Number(d.version || 1),
        ]
      );
      if (d.is_main || dId === parsed.root_doc_id || (!restoredRootDocId && d.name === 'main.tex')) {
        restoredRootDocId = dId;
      }
    }

    if (!restoredRootDocId && snapshotDocs.length > 0) {
      const [firstDoc] = await pool.query<any[]>('SELECT id FROM latex_docs WHERE project_id = ? LIMIT 1', [project.id]);
      restoredRootDocId = firstDoc?.[0]?.id || null;
    }

    for (const fl of snapshotFiles) {
      const flId = fl.id || `file-${crypto.randomUUID()}`;
      const dataBuffer = fl.data_base64 ? Buffer.from(fl.data_base64, 'base64') : null;
      await pool.query(
        `INSERT INTO latex_files (id, project_id, folder_id, name, path, size, mime_type, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          flId,
          project.id,
          fl.folder_id || null,
          fl.name,
          fl.path || fl.name,
          dataBuffer ? dataBuffer.length : Number(fl.size || 0),
          fl.mime_type || 'application/octet-stream',
          dataBuffer,
        ]
      );
    }

    const versionTag = snapshotRow.label || `v${snapshotRow.version || 1}`;

    await pool.query(
      `UPDATE latex_projects
       SET compiler = ?, root_doc_id = ?, version_tag = ?, current_version_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [restoredCompiler, restoredRootDocId, versionTag, snapshotRow.id, project.id]
    );

    await pool.query(
      `UPDATE documents
       SET version_tag = ?, current_version_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [versionTag, snapshotRow.id, documentId]
    );

    const formatted = formatVersionSnapshotRow(snapshotRow, documentId, snapshotRow.id);

    return res.json({
      success: true,
      message: `Version "${versionTag}" is now the current working version.`,
      version_tag: versionTag,
      current_version_id: snapshotRow.id,
      version: formatted,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to restore LaTeX version', detail: err.message });
  }
}

latexRoutes.post('/documents/:id/latex/versions/:versionId/restore', requireAuth, handleRestoreLatexVersion);
latexRoutes.post('/documents/:id/latex/versions/:versionId/checkout', requireAuth, handleRestoreLatexVersion);

