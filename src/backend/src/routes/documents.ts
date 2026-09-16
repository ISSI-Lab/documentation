import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { compileDocumentMarkdown } from '../compiler';
import { Document, Template } from '../models';
import { AuthenticatedRequest, isTeamMember, optionalAuth, requireAuth } from '../auth';

export const documentsRouter = Router();

function formatDocumentRow(row: any): Document {
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

  let elementsData: Record<string, any> = {};
  if (typeof row.elements_data === 'string') {
    try {
      elementsData = JSON.parse(row.elements_data);
    } catch {
      elementsData = {};
    }
  } else if (typeof row.elements_data === 'object' && row.elements_data !== null) {
    elementsData = row.elements_data;
  }

  return {
    id: row.id,
    title: row.title,
    project_id: row.project_id || null,
    team_id: row.team_id || null,
    template_id: row.template_id,
    template_title: row.template_title,
    status: row.status,
    author: row.author || 'Anonymous',
    created_by: row.created_by || null,
    last_edited_by: row.last_edited_by || null,
    tags,
    elements_data: elementsData,
    compiled_markdown: row.compiled_markdown || '',
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/documents - List documents with team/project filtering
documentsRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { team_id, project_id, template_id, search, tag } = req.query;

    let query = 'SELECT * FROM documents';
    const params: any[] = [];
    const conditions: string[] = [];

    // Filter by team membership if user is authenticated
    if (userId) {
      conditions.push(
        `(team_id IS NULL OR team_id IN (SELECT team_id FROM team_members WHERE user_id = ?))`
      );
      params.push(userId);
    }

    if (team_id && typeof team_id === 'string') {
      conditions.push('team_id = ?');
      params.push(team_id);
    }

    if (project_id && typeof project_id === 'string') {
      conditions.push('project_id = ?');
      params.push(project_id);
    }

    if (template_id && typeof template_id === 'string') {
      conditions.push('template_id = ?');
      params.push(template_id);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)');
      params.push(q, q);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY updated_at DESC';

    const [rows] = await pool.query<any[]>(query, params);
    let docs = rows.map(formatDocumentRow);

    if (tag && typeof tag === 'string' && tag.trim()) {
      const targetTag = tag.trim().toLowerCase();
      docs = docs.filter((d) => d.tags && d.tags.some((t) => t.toLowerCase() === targetTag));
    }

    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve documents', detail: err.message });
  }
});

// GET /api/v1/documents/:id
documentsRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(formatDocumentRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve document', detail: err.message });
  }
});

// POST /api/v1/documents - Create document in project/team
documentsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { title, template_id, project_id, author, tags, elements_data } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    if (!template_id || typeof template_id !== 'string') {
      return res.status(400).json({ error: 'Valid template_id is required' });
    }

    let teamId: string | null = null;

    if (project_id) {
      const [projRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [project_id]);
      if (!projRows || projRows.length === 0) {
        return res.status(400).json({ error: 'Selected project not found' });
      }
      teamId = projRows[0].team_id;

      // Verify user is member of this team
      const isMember = await isTeamMember(user.id, teamId!);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the team for this project' });
      }
    }

    // Fetch template details
    const [tplRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [template_id]);
    if (!tplRows || tplRows.length === 0) {
      return res.status(400).json({ error: `Template with ID '${template_id}' not found` });
    }

    const tplRow = tplRows[0];
    let templateElements: any[] = [];
    if (typeof tplRow.document_elements === 'string') {
      try {
        templateElements = JSON.parse(tplRow.document_elements);
      } catch {
        templateElements = [];
      }
    } else if (Array.isArray(tplRow.document_elements)) {
      templateElements = tplRow.document_elements;
    }

    const template: Template = {
      id: tplRow.id,
      title: tplRow.title,
      description: tplRow.description,
      category: tplRow.category,
      icon: tplRow.icon,
      visibility: tplRow.visibility || 'private',
      team_id: tplRow.team_id || null,
      created_by: tplRow.created_by || null,
      tags: [],
      document_elements: templateElements,
      created_at: new Date(tplRow.created_at).toISOString(),
      updated_at: new Date(tplRow.updated_at).toISOString(),
    };

    // Initialize elements data
    const finalElementsData: Record<string, any> = {};
    for (const elem of template.document_elements) {
      if (elements_data && elements_data[elem.id] !== undefined) {
        finalElementsData[elem.id] = elements_data[elem.id];
      } else {
        finalElementsData[elem.id] = elem.default_value || '';
      }
    }

    const docId = `doc-${crypto.randomBytes(4).toString('hex')}`;
    const cleanAuthor = (author && typeof author === 'string' && author.trim()) || user.name || user.username;
    const cleanTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
    const status = 'draft';

    const compiledMd = compileDocumentMarkdown(
      title.trim(),
      status,
      cleanAuthor,
      cleanTags,
      template,
      finalElementsData
    );

    await pool.query(
      `INSERT INTO documents (id, title, project_id, team_id, template_id, template_title, status, author, created_by, last_edited_by, tags, elements_data, compiled_markdown, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        docId,
        title.trim(),
        project_id || null,
        teamId,
        template.id,
        template.title,
        status,
        cleanAuthor,
        user.id,
        user.id,
        JSON.stringify(cleanTags),
        JSON.stringify(finalElementsData),
        compiledMd,
      ]
    );

    const [createdRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [docId]);
    res.status(201).json(formatDocumentRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create document', detail: err.message });
  }
});

// PUT /api/v1/documents/:id - Update document (Co-documenting: any team member can edit)
documentsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const [existing] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentDoc = existing[0];

    // Verify user is a member of the team if document belongs to a team
    if (currentDoc.team_id) {
      const isMember = await isTeamMember(user.id, currentDoc.team_id);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the team for this document' });
      }
    }

    const { title, status, author, tags, elements_data, project_id } = req.body;

    const newTitle = title !== undefined && typeof title === 'string' ? title.trim() : currentDoc.title;
    const newStatus = status !== undefined ? status : currentDoc.status;
    const newAuthor = author !== undefined ? author : currentDoc.author;
    const newProjectId = project_id !== undefined ? project_id : currentDoc.project_id;

    let currentTags: string[] = [];
    if (typeof currentDoc.tags === 'string') {
      try {
        currentTags = JSON.parse(currentDoc.tags);
      } catch {
        currentTags = [];
      }
    } else if (Array.isArray(currentDoc.tags)) {
      currentTags = currentDoc.tags;
    }
    const newTags = tags !== undefined && Array.isArray(tags) ? tags : currentTags;

    let currentData: Record<string, any> = {};
    if (typeof currentDoc.elements_data === 'string') {
      try {
        currentData = JSON.parse(currentDoc.elements_data);
      } catch {
        currentData = {};
      }
    } else if (typeof currentDoc.elements_data === 'object' && currentDoc.elements_data !== null) {
      currentData = currentDoc.elements_data;
    }

    const finalElementsData = elements_data !== undefined ? { ...currentData, ...elements_data } : currentData;

    // Fetch linked template for compiling markdown
    let template: Template | null = null;
    const [tplRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [currentDoc.template_id]);
    if (tplRows && tplRows.length > 0) {
      const t = tplRows[0];
      let tElements: any[] = [];
      if (typeof t.document_elements === 'string') {
        try {
          tElements = JSON.parse(t.document_elements);
        } catch {
          tElements = [];
        }
      } else if (Array.isArray(t.document_elements)) {
        tElements = t.document_elements;
      }

      template = {
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        icon: t.icon,
        visibility: t.visibility || 'private',
        team_id: t.team_id || null,
        created_by: t.created_by || null,
        tags: [],
        document_elements: tElements,
        created_at: new Date(t.created_at).toISOString(),
        updated_at: new Date(t.updated_at).toISOString(),
      };
    }

    const compiledMd = compileDocumentMarkdown(
      newTitle,
      newStatus,
      newAuthor,
      newTags,
      template,
      finalElementsData
    );

    await pool.query(
      `UPDATE documents 
       SET title = ?, status = ?, author = ?, project_id = ?, last_edited_by = ?, tags = ?, elements_data = ?, compiled_markdown = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        newTitle,
        newStatus,
        newAuthor,
        newProjectId,
        user.id,
        JSON.stringify(newTags),
        JSON.stringify(finalElementsData),
        compiledMd,
        id,
      ]
    );

    const [updatedRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [id]);
    res.json(formatDocumentRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update document', detail: err.message });
  }
});

// DELETE /api/v1/documents/:id
documentsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const [rows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = rows[0];
    if (doc.team_id) {
      const isMember = await isTeamMember(user.id, doc.team_id);
      if (!isMember) {
        return res.status(403).json({ error: 'You do not have permission to delete this document' });
      }
    }

    await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete document', detail: err.message });
  }
});

// GET /api/v1/documents/:id/export/markdown
documentsRouter.get('/:id/export/markdown', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = formatDocumentRow(rows[0]);

    const cleanFilename =
      doc.title
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'document';

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.md"`);
    res.send(doc.compiled_markdown);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export document markdown', detail: err.message });
  }
});
