import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool, seedDefaultTemplates } from '../db';
import { DocumentElementConfig, Template, TemplateVisibility } from '../models';
import { AuthenticatedRequest, isTeamManager, optionalAuth, requireAuth } from '../auth';

export const templatesRouter = Router();

function formatTemplateRow(row: any): Template {
  let elements: DocumentElementConfig[] = [];
  if (typeof row.document_elements === 'string') {
    try {
      elements = JSON.parse(row.document_elements);
    } catch {
      elements = [];
    }
  } else if (Array.isArray(row.document_elements)) {
    elements = row.document_elements;
  }

  // Ensure level property exists
  elements = elements.map((e, idx) => ({
    ...e,
    level: typeof e.level === 'number' ? e.level : 1,
    order: typeof e.order === 'number' ? e.order : idx,
  }));

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
    category: row.category || 'General',
    icon: row.icon || 'file-text',
    visibility: (row.visibility as TemplateVisibility) || 'private',
    team_id: row.team_id || null,
    created_by: row.created_by || null,
    tags,
    document_elements: elements,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/templates - List accessible templates
templatesRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { team_id, visibility, tag, search } = req.query;

    let query = 'SELECT * FROM templates WHERE ';
    const conditions: string[] = [];
    const params: any[] = [];

    // Base visibility filter:
    if (userId) {
      // Authenticated: can see public templates OR private templates of teams they belong to
      conditions.push(
        `(visibility = 'public' OR team_id IN (SELECT team_id FROM team_members WHERE user_id = ?))`
      );
      params.push(userId);
    } else {
      // Unauthenticated: only public templates
      conditions.push(`visibility = 'public'`);
    }

    if (team_id && typeof team_id === 'string') {
      conditions.push('team_id = ?');
      params.push(team_id);
    }

    if (visibility && (visibility === 'public' || visibility === 'private')) {
      conditions.push('visibility = ?');
      params.push(visibility);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)');
      params.push(q, q, q);
    }

    query += conditions.join(' AND ') + ' ORDER BY created_at ASC';

    const [rows] = await pool.query<any[]>(query, params);
    let templates = rows.map(formatTemplateRow);

    // Filter by tag in memory if specified
    if (tag && typeof tag === 'string' && tag.trim()) {
      const targetTag = tag.trim().toLowerCase();
      templates = templates.filter((t) => t.tags && t.tags.some((tagItem) => tagItem.toLowerCase() === targetTag));
    }

    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve templates', detail: err.message });
  }
});

// GET /api/v1/templates/:id
templatesRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const template = formatTemplateRow(rows[0]);
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve template', detail: err.message });
  }
});

// POST /api/v1/templates - Create template (Manager or Organizer check)
templatesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { title, description, category, icon, visibility, team_id, tags, document_elements } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Template title is required' });
    }

    const finalVisibility: TemplateVisibility = visibility === 'public' ? 'public' : 'private';

    // Permission check:
    // If private template for a team: caller must be team creator or assigned manager in that team
    if (finalVisibility === 'private') {
      if (!team_id) {
        return res.status(400).json({ error: 'Team ID is required for private templates' });
      }
      const isManager = await isTeamManager(user.id, team_id);
      if (!isManager && user.user_type !== 'organizer') {
        return res.status(403).json({
          error: 'Permission denied: Only team managers and creators can create templates for this team.',
        });
      }
    } else {
      // Public template: requires user to be an organizer or manager
      if (user.user_type !== 'organizer') {
        return res.status(403).json({
          error: 'Permission denied: Only organizers can publish public templates.',
        });
      }
    }

    const id = `tpl-${crypto.randomBytes(4).toString('hex')}`;
    const cleanElements: DocumentElementConfig[] = Array.isArray(document_elements)
      ? document_elements.map((elem: any, idx: number) => ({
          id: elem.id || `elem_${idx + 1}`,
          label: elem.label || `Section ${idx + 1}`,
          description: elem.description || '',
          field_type: elem.field_type || 'markdown',
          level: typeof elem.level === 'number' ? Math.max(1, Math.min(elem.level, 4)) : 1,
          placeholder: elem.placeholder || '',
          default_value: elem.default_value !== undefined ? elem.default_value : '',
          required: Boolean(elem.required),
          order: idx,
          options: Array.isArray(elem.options) ? elem.options : null,
        }))
      : [];

    const cleanTags = Array.isArray(tags)
      ? tags.map((t: any) => String(t).trim()).filter(Boolean)
      : [];

    await pool.query(
      `INSERT INTO templates (id, title, description, category, icon, visibility, team_id, created_by, tags, document_elements, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        title.trim(),
        description || '',
        category || 'General',
        icon || 'file-text',
        finalVisibility,
        team_id || null,
        user.id,
        JSON.stringify(cleanTags),
        JSON.stringify(cleanElements),
      ]
    );

    const [createdRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    res.status(201).json(formatTemplateRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create template', detail: err.message });
  }
});

// PUT /api/v1/templates/:id - Update template (Manager or Creator check)
templatesRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const [existing] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const current = existing[0];

    // Authorization check
    if (current.team_id) {
      const isManager = await isTeamManager(user.id, current.team_id);
      if (!isManager && current.created_by !== user.id && user.user_type !== 'organizer') {
        return res.status(403).json({ error: 'Only team managers can edit this team template' });
      }
    } else if (current.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({ error: 'Only the creator or an organizer can edit this template' });
    }

    const { title, description, category, icon, visibility, tags, document_elements } = req.body;

    let elementsJson = current.document_elements;
    if (document_elements !== undefined) {
      const cleanElements = Array.isArray(document_elements)
        ? document_elements.map((elem: any, idx: number) => ({
            id: elem.id || `elem_${idx + 1}`,
            label: elem.label || `Section ${idx + 1}`,
            description: elem.description || '',
            field_type: elem.field_type || 'markdown',
            level: typeof elem.level === 'number' ? Math.max(1, Math.min(elem.level, 4)) : 1,
            placeholder: elem.placeholder || '',
            default_value: elem.default_value !== undefined ? elem.default_value : '',
            required: Boolean(elem.required),
            order: idx,
            options: Array.isArray(elem.options) ? elem.options : null,
          }))
        : [];
      elementsJson = JSON.stringify(cleanElements);
    } else if (typeof elementsJson !== 'string') {
      elementsJson = JSON.stringify(elementsJson);
    }

    let tagsJson = current.tags;
    if (tags !== undefined) {
      const cleanTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
      tagsJson = JSON.stringify(cleanTags);
    } else if (typeof tagsJson !== 'string') {
      tagsJson = JSON.stringify(tagsJson || []);
    }

    const newVisibility = visibility !== undefined ? visibility : current.visibility;

    await pool.query(
      `UPDATE templates 
       SET title = ?, description = ?, category = ?, icon = ?, visibility = ?, tags = ?, document_elements = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title !== undefined ? title.trim() : current.title,
        description !== undefined ? description : current.description,
        category !== undefined ? category : current.category,
        icon !== undefined ? icon : current.icon,
        newVisibility,
        tagsJson,
        elementsJson,
        id,
      ]
    );

    const [updatedRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    res.json(formatTemplateRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update template', detail: err.message });
  }
});

// DELETE /api/v1/templates/:id
templatesRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const [existing] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const current = existing[0];
    if (current.team_id) {
      const isManager = await isTeamManager(user.id, current.team_id);
      if (!isManager && current.created_by !== user.id && user.user_type !== 'organizer') {
        return res.status(403).json({ error: 'Only team managers can delete this template' });
      }
    } else if (current.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({ error: 'Only the creator or an organizer can delete this template' });
    }

    await pool.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete template', detail: err.message });
  }
});

// POST /api/v1/templates/actions/reset-seeds
templatesRouter.post('/actions/reset-seeds', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await seedDefaultTemplates();
    const [rows] = await pool.query<any[]>('SELECT * FROM templates ORDER BY created_at ASC');
    res.json(rows.map(formatTemplateRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset seed templates', detail: err.message });
  }
});
