import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool, seedDefaultTemplates } from '../db';
import { DocumentElementConfig, Template, TemplateVisibility } from '../models';
import { AuthenticatedRequest, isOrganizationManager, optionalAuth, requireAuth } from '../auth';

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

  const orgId = row.organization_id || row.team_id || null;

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'General',
    icon: row.icon || 'file-text',
    visibility: (row.visibility as TemplateVisibility) || 'private',
    organization_id: orgId,
    team_id: orgId, // compatibility
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
    const { organization_id, team_id, visibility, tag, search, scope } = req.query;
    const targetOrgId = (organization_id || team_id) as string | undefined;

    let query = 'SELECT * FROM templates WHERE ';
    const conditions: string[] = [];
    const params: any[] = [];

    // Base visibility filter:
    if (userId) {
      // Authenticated: can see public templates OR their own personal templates OR private templates of organizations they belong to
      conditions.push(
        `(visibility = 'public' OR created_by = ? OR (organization_id IS NOT NULL AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?)))`
      );
      params.push(userId, userId);
    } else {
      // Unauthenticated: only public templates
      conditions.push(`visibility = 'public'`);
    }

    if (scope === 'personal' || targetOrgId === 'personal' || targetOrgId === 'null') {
      if (userId) {
        conditions.push('created_by = ? AND organization_id IS NULL');
        params.push(userId);
      }
    } else if (targetOrgId && typeof targetOrgId === 'string') {
      conditions.push('organization_id = ?');
      params.push(targetOrgId);
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

// POST /api/v1/templates - Create template (Personal, Organization, or Public)
templatesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { title, description, category, icon, visibility, organization_id, team_id, tags, document_elements } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Template title is required' });
    }

    const finalVisibility: TemplateVisibility = visibility === 'public' ? 'public' : 'private';
    const rawOrgId = organization_id || team_id;
    const finalOrgId: string | null = finalVisibility === 'private' && rawOrgId ? String(rawOrgId) : null;

    // Permission check:
    if (finalVisibility === 'private') {
      if (finalOrgId) {
        // Scoped to organization: check organization manager/creator
        const isManager = await isOrganizationManager(user.id, finalOrgId);
        if (!isManager && user.user_type !== 'organizer') {
          return res.status(403).json({
            error: 'Permission denied: Only organization managers and creators can create templates for this organization.',
          });
        }
      }
      // If finalOrgId is null, it is a personal template. Any logged-in user can create personal templates!
    } else {
      // Public template
      if (user.user_type !== 'organizer') {
        return res.status(403).json({
          error: 'Permission denied: Only organizers can publish public templates.',
        });
      }
    }

    const id = `tpl-${crypto.randomBytes(4).toString('hex')}`;
    const cleanElements: DocumentElementConfig[] = Array.isArray(document_elements)
      ? document_elements.map((elem: any, idx: number) => {
          let defaultValue = elem.default_value !== undefined ? elem.default_value : '';
          if (Array.isArray(defaultValue)) {
            defaultValue = defaultValue.map((item: any, itemIdx: number) => {
              const desc = item.description || item.title || `Item ${itemIdx + 1}`;
              const val = item.value !== undefined ? item.value : (item.content || '');
              return {
                id: item.id || `item_${itemIdx + 1}`,
                description: desc,
                value: val,
                title: desc,
                content: val,
              };
            });
          }
          return {
            id: elem.id || `elem_${idx + 1}`,
            label: elem.label || `Section ${idx + 1}`,
            description: elem.description || '',
            field_type: elem.field_type || 'markdown',
            level: typeof elem.level === 'number' ? Math.max(1, Math.min(elem.level, 4)) : 1,
            placeholder: elem.placeholder || '',
            default_value: defaultValue,
            required: Boolean(elem.required),
            order: idx,
            options: Array.isArray(elem.options) ? elem.options : null,
            view_markdown: elem.view_markdown || elem.view_only_markdown || null,
          };
        })
      : [];

    const cleanTags = Array.isArray(tags)
      ? tags.map((t: any) => String(t).trim()).filter(Boolean)
      : [];

    await pool.query(
      `INSERT INTO templates (id, title, description, category, icon, visibility, organization_id, created_by, tags, document_elements, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        title.trim(),
        description || '',
        category || 'General',
        icon || 'file-text',
        finalVisibility,
        finalOrgId,
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
    const currentOrgId = current.organization_id || current.team_id;

    // Authorization check
    if (currentOrgId) {
      const isManager = await isOrganizationManager(user.id, currentOrgId);
      if (!isManager && current.created_by !== user.id && user.user_type !== 'organizer') {
        return res.status(403).json({ error: 'Only organization managers can edit this organization template' });
      }
    } else if (current.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({ error: 'Only the creator or an organizer can edit this template' });
    }

    const { title, description, category, icon, visibility, tags, document_elements } = req.body;

    let elementsJson = current.document_elements;
    if (document_elements !== undefined) {
      const cleanElements = Array.isArray(document_elements)
        ? document_elements.map((elem: any, idx: number) => {
            let defaultValue = elem.default_value !== undefined ? elem.default_value : '';
            if (Array.isArray(defaultValue)) {
              defaultValue = defaultValue.map((item: any, itemIdx: number) => {
                const desc = item.description || item.title || `Item ${itemIdx + 1}`;
                const val = item.value !== undefined ? item.value : (item.content || '');
                return {
                  id: item.id || `item_${itemIdx + 1}`,
                  description: desc,
                  value: val,
                  title: desc,
                  content: val,
                };
              });
            }
            return {
              id: elem.id || `elem_${idx + 1}`,
              label: elem.label || `Section ${idx + 1}`,
              description: elem.description || '',
              field_type: elem.field_type || 'markdown',
              level: typeof elem.level === 'number' ? Math.max(1, Math.min(elem.level, 4)) : 1,
              placeholder: elem.placeholder || '',
              default_value: defaultValue,
              required: Boolean(elem.required),
              order: idx,
              options: Array.isArray(elem.options) ? elem.options : null,
              view_markdown: elem.view_markdown || elem.view_only_markdown || null,
            };
          })
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
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isManager = await isOrganizationManager(user.id, currentOrgId);
      if (!isManager && current.created_by !== user.id && user.user_type !== 'organizer') {
        return res.status(403).json({ error: 'Only organization managers can delete this template' });
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
