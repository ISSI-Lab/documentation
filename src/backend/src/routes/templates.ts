import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool, seedDefaultTemplates } from '../db';
import { DocumentElementConfig, Template, TemplateVisibility } from '../models';
import { AuthenticatedRequest, isOrganizationCreator, isOrganizationManager, isOrganizationMember, optionalAuth, requireAuth } from '../auth';

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
    creator_name: row.creator_name || undefined,
    creator_username: row.creator_username || undefined,
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

    let query = `
      SELECT t.*, u.name as creator_name, u.username as creator_username
      FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    // Base visibility filter:
    if (userId) {
      // Authenticated: can see public templates OR their own personal templates OR private templates of organizations they belong to
      conditions.push(
        `(t.visibility = 'public' OR t.created_by = ? OR (t.organization_id IS NOT NULL AND t.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?)))`
      );
      params.push(userId, userId);
    } else {
      // Unauthenticated: only public templates
      conditions.push(`t.visibility = 'public'`);
    }

    if (scope === 'personal' || targetOrgId === 'personal' || targetOrgId === 'null') {
      if (userId) {
        conditions.push('t.created_by = ? AND t.organization_id IS NULL');
        params.push(userId);
      }
    } else if (targetOrgId && typeof targetOrgId === 'string') {
      conditions.push('t.organization_id = ?');
      params.push(targetOrgId);
    }

    if (visibility && (visibility === 'public' || visibility === 'private')) {
      conditions.push('t.visibility = ?');
      params.push(visibility);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(t.category) LIKE ?)');
      params.push(q, q, q);
    }

    query += conditions.join(' AND ') + ' ORDER BY t.created_at ASC';

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
    const [rows] = await pool.query<any[]>(
      `SELECT t.*, u.name as creator_name, u.username as creator_username
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const template = formatTemplateRow(rows[0]);
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve template', detail: err.message });
  }
});

function sanitizeDocumentElements(rawElements: any): DocumentElementConfig[] {
  if (!Array.isArray(rawElements)) return [];
  return rawElements.map((elem: any, idx: number) => {
    let cleanContainerChildren: any = null;
    if (Array.isArray(elem.container_children)) {
      cleanContainerChildren = elem.container_children
        .filter((c: any) => c && (c.key || c.label || c.content || c.type))
        .map((c: any, cIdx: number) => ({
          id: c.id || `child_${cIdx + 1}`,
          type: c.type || 'key_value',
          key: c.key ? String(c.key).trim() : undefined,
          label: c.label ? String(c.label).trim() : (c.key ? String(c.key).trim() : undefined),
          description: c.description ? String(c.description).trim() : undefined,
          placeholder: c.placeholder ? String(c.placeholder).trim() : undefined,
          content: c.content !== undefined ? String(c.content) : undefined,
          default_value: c.default_value !== undefined ? String(c.default_value) : undefined,
        }));
    }

    let cleanIterationFields: any = null;
    if (Array.isArray(elem.iteration_fields)) {
      cleanIterationFields = elem.iteration_fields
        .filter((f: any) => f && (f.key || f.label))
        .map((f: any, fIdx: number) => ({
          id: f.id || `field_${fIdx + 1}`,
          key: String(f.key || f.label || `Field ${fIdx + 1}`).trim(),
          label: f.label ? String(f.label).trim() : undefined,
          description: f.description ? String(f.description).trim() : undefined,
          placeholder: f.placeholder ? String(f.placeholder).trim() : undefined,
          default_value: f.default_value !== undefined ? String(f.default_value) : undefined,
        }));
    } else if (cleanContainerChildren && cleanContainerChildren.length > 0) {
      cleanIterationFields = cleanContainerChildren
        .filter((c: any) => c.type === 'key_value')
        .map((c: any) => ({
          id: c.id,
          key: c.key || c.label || c.id,
          label: c.label,
          description: c.description,
          placeholder: c.placeholder,
          default_value: c.default_value,
        }));
    }

    if (!cleanContainerChildren && cleanIterationFields && cleanIterationFields.length > 0) {
      cleanContainerChildren = cleanIterationFields.map((f: any) => ({
        id: f.id,
        type: 'key_value',
        key: f.key,
        label: f.label || f.key,
        description: f.description,
        placeholder: f.placeholder,
        default_value: f.default_value,
      }));
    }

    let defaultValue = elem.default_value !== undefined ? elem.default_value : '';
    const isIterative =
      elem.field_type === 'iteration_container' ||
      elem.field_type === 'iteration_group' ||
      elem.field_type === 'interactive_list' ||
      elem.field_type === 'repeatable_list' ||
      Boolean(cleanContainerChildren && cleanContainerChildren.length > 0) ||
      Boolean(cleanIterationFields && cleanIterationFields.length > 0);

    if (isIterative && (!cleanContainerChildren || cleanContainerChildren.length === 0)) {
      cleanContainerChildren = [
        { id: 'reason', type: 'key_value', key: 'Reason', label: 'Reason', description: 'Explanation or root cause', placeholder: 'Enter reason...' },
        { id: 'todo', type: 'key_value', key: 'Todo', label: 'Todo', description: 'Action items to be taken', placeholder: 'Enter action items...' },
        { id: 'response', type: 'key_value', key: 'Response', label: 'Response', description: 'Observed outcome or system response', placeholder: 'Enter response...' },
      ];
      cleanIterationFields = cleanContainerChildren.map((c: any) => ({
        id: c.id,
        key: c.key,
        label: c.label,
        description: c.description,
        placeholder: c.placeholder,
      }));
    }

    if (isIterative) {
      if (Array.isArray(defaultValue) && defaultValue.length > 0) {
        if (defaultValue[0]?.values !== undefined || defaultValue[0]?.iteration_number !== undefined) {
          defaultValue = defaultValue.map((iterItem: any, iterIdx: number) => {
            const iterNum = iterItem.iteration_number || (iterIdx + 1);
            const iterTitle = iterItem.title || `Iteration #${iterNum}`;
            const values: Record<string, string> = { ...(iterItem.values || {}) };
            for (const c of cleanContainerChildren || []) {
              const k = c.key || c.id;
              if (values[k] === undefined) {
                values[k] = c.default_value || '';
              }
            }
            return {
              id: iterItem.id || `iter_${iterIdx + 1}`,
              iteration_number: iterNum,
              title: iterTitle,
              values,
            };
          });
        } else {
          const values: Record<string, string> = {};
          for (const item of defaultValue) {
            const k = item.description || item.title || item.key;
            if (k) {
              values[String(k).trim()] = String(item.value !== undefined ? item.value : (item.content || ''));
            }
          }
          for (const c of cleanContainerChildren || []) {
            const k = c.key || c.id;
            if (values[k] === undefined) {
              values[k] = c.default_value || '';
            }
          }
          defaultValue = [
            {
              id: 'iter_1',
              iteration_number: 1,
              title: 'Iteration #1',
              values,
            },
          ];
        }
      } else {
        const values: Record<string, string> = {};
        for (const c of cleanContainerChildren || []) {
          const k = c.key || c.id;
          values[k] = c.default_value || '';
        }
        defaultValue = [
          {
            id: 'iter_1',
            iteration_number: 1,
            title: 'Iteration #1',
            values,
          },
        ];
      }
    } else if (Array.isArray(defaultValue)) {
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
      iteration_fields: cleanIterationFields,
      container_children: cleanContainerChildren,
    };
  });
}

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
    const cleanElements: DocumentElementConfig[] = sanitizeDocumentElements(document_elements);

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

    const [createdRows] = await pool.query<any[]>(
      `SELECT t.*, u.name as creator_name, u.username as creator_username
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [id]
    );
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
      const cleanElements = sanitizeDocumentElements(document_elements);
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

    const [updatedRows] = await pool.query<any[]>(
      `SELECT t.*, u.name as creator_name, u.username as creator_username
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [id]
    );
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

// POST /api/v1/templates/:id/copy - Copy template from one organization to the creator's other organization
templatesRouter.post('/:id/copy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const [existing] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
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
        error: 'Cannot copy template to the same organization. Please select a different organization.',
      });
    }

    // Verify target organization exists
    const [targetOrgRows] = await pool.query<any[]>('SELECT * FROM organizations WHERE id = ?', [targetOrgId]);
    if (!targetOrgRows || targetOrgRows.length === 0) {
      return res.status(404).json({ error: 'Target organization not found' });
    }

    // Permission check for target organization:
    // "to the creator's other organization" -> user must be the creator of the target organization
    const isTargetCreator = await isOrganizationCreator(user.id, targetOrgId);
    if (!isTargetCreator && user.user_type !== 'organizer') {
      return res.status(403).json({
        error: 'Permission denied: You can only copy templates to organizations where you are the creator.',
      });
    }

    // Permission check for source template:
    // If source template is in an organization, only the template creator or organization creator/manager can copy it
    if (sourceOrgId) {
      const isTemplateCreator = sourceTemplate.created_by === user.id;
      const isSourceOrgCreator = await isOrganizationCreator(user.id, sourceOrgId);
      const isSourceOrgManager = await isOrganizationManager(user.id, sourceOrgId);
      if (!isTemplateCreator && !isSourceOrgCreator && !isSourceOrgManager && user.user_type !== 'organizer') {
        return res.status(403).json({
          error: 'Permission denied: Only the template creator or organization creator can copy this organization template.',
        });
      }
    } else if (sourceTemplate.visibility === 'private' && sourceTemplate.created_by !== user.id && user.user_type !== 'organizer') {
      return res.status(403).json({
        error: 'Permission denied: Only the creator can copy this private template.',
      });
    }

    const newId = `tpl-${crypto.randomBytes(4).toString('hex')}`;
    const newTitle =
      req.body.title && typeof req.body.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : sourceTemplate.title;

    let elements = [];
    if (typeof sourceTemplate.document_elements === 'string') {
      try {
        elements = JSON.parse(sourceTemplate.document_elements);
      } catch {
        elements = [];
      }
    } else if (Array.isArray(sourceTemplate.document_elements)) {
      elements = sourceTemplate.document_elements;
    }
    const cleanElements = sanitizeDocumentElements(elements);

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
      `INSERT INTO templates (id, title, description, category, icon, visibility, organization_id, created_by, tags, document_elements, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'private', ?, ?, ?, ?, NOW(), NOW())`,
      [
        newId,
        newTitle,
        sourceTemplate.description || '',
        sourceTemplate.category || 'General',
        sourceTemplate.icon || 'file-text',
        targetOrgId,
        user.id,
        JSON.stringify(cleanTags),
        JSON.stringify(cleanElements),
      ]
    );

    const [createdRows] = await pool.query<any[]>(
      `SELECT t.*, u.name as creator_name, u.username as creator_username
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [newId]
    );

    res.status(201).json(formatTemplateRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to copy template', detail: err.message });
  }
});

// POST /api/v1/templates/actions/reset-seeds
templatesRouter.post('/actions/reset-seeds', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await seedDefaultTemplates();
    const [rows] = await pool.query<any[]>(
      `SELECT t.*, u.name as creator_name, u.username as creator_username
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       ORDER BY t.created_at ASC`
    );
    res.json(rows.map(formatTemplateRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset seed templates', detail: err.message });
  }
});
