import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { compileDocumentMarkdown } from '../compiler';
import {
  Document,
  DocumentSubmission,
  DocumentType,
  SubmissionComment,
  SubmissionStatus,
  SubmissionType,
  Template,
} from '../models';
import { AuthenticatedRequest, isOrganizationCreator, isOrganizationManager, isOrganizationMember, optionalAuth, requireAuth } from '../auth';

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

  const orgId = row.organization_id || row.team_id || null;

  return {
    id: row.id,
    title: row.title,
    project_id: row.project_id || null,
    project_association_type: row.project_association_type || null,
    organization_id: orgId,
    team_id: orgId, // compatibility
    assigned_team_id: row.assigned_team_id || null,
    assigned_team_name: row.assigned_team_name || row.team_name || undefined,
    template_id: row.template_id,
    template_title: row.template_title,
    document_type: row.document_type === 'personal' ? 'personal' : 'project_shared',
    is_submittable: Boolean(row.is_submittable),
    copied_from_id: row.copied_from_id || null,
    master_creator_id: row.master_creator_id || null,
    status: row.status,
    author: row.author || 'Anonymous',
    created_by: row.created_by || null,
    creator_name: row.creator_name || undefined,
    creator_username: row.creator_username || undefined,
    last_edited_by: row.last_edited_by || null,
    tags,
    elements_data: elementsData,
    compiled_markdown: row.compiled_markdown || '',
    submissions_count: Number(row.submissions_count || 0),
    copies_count: Number(row.copies_count || 0),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

function formatSubmissionRow(row: any, comments: SubmissionComment[] = []): DocumentSubmission {
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
    document_id: row.document_id,
    project_id: row.project_id,
    submission_type: (row.submission_type || 'personal') as SubmissionType,
    user_id: row.user_id || null,
    user_name: row.user_name || undefined,
    user_email: row.user_email || undefined,
    team_id: row.team_id || null,
    team_name: row.team_name || undefined,
    status: (row.status || 'draft') as SubmissionStatus,
    elements_data: elementsData,
    compiled_markdown: row.compiled_markdown || '',
    submitted_at: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    comments_count: Number(row.comments_count !== undefined ? row.comments_count : comments.length),
    comments,
  };
}

async function fetchTemplateById(templateId: string): Promise<Template | null> {
  try {
    const [tplRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (!tplRows || tplRows.length === 0) return null;
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
    const tOrgId = t.organization_id || t.team_id || null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      icon: t.icon,
      visibility: t.visibility || 'private',
      organization_id: tOrgId,
      team_id: tOrgId,
      created_by: t.created_by || null,
      tags: [],
      document_elements: tElements,
      created_at: new Date(t.created_at).toISOString(),
      updated_at: new Date(t.updated_at).toISOString(),
    };
  } catch {
    return null;
  }
}

// GET /api/v1/documents - List documents with organization/project filtering
documentsRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      organization_id,
      team_id,
      project_id,
      template_id,
      search,
      tag,
      scope,
      document_type,
      is_submittable,
    } = req.query;
    const targetOrgId = (organization_id || team_id) as string | undefined;

    let query = `
      SELECT d.*,
        u.name as creator_name,
        u.username as creator_username,
        p.association_type as project_association_type,
        ot.name as assigned_team_name,
        (SELECT COUNT(*) FROM document_submissions WHERE (document_id = d.id OR document_id IN (SELECT id FROM documents WHERE copied_from_id = d.id)) AND status = 'submitted') as submissions_count,
        (SELECT COUNT(*) FROM documents WHERE copied_from_id = d.id) as copies_count,
        (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN organization_teams ot ON d.assigned_team_id = ot.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    // Filter by ownership/membership if user is authenticated
    if (userId) {
      conditions.push(
        `((d.organization_id IS NULL AND d.created_by = ?) OR (d.organization_id IS NOT NULL AND d.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?)))`
      );
      params.push(userId, userId);

      // Document isolation and visibility scoping:
      // 1. Master documents (copied_from_id IS NULL):
      //    - If project_shared: visible to all project/org members UNLESS this member's team already copied it.
      //    - If personal: visible if user is creator OR (if is_submittable = 1 AND user hasn't copied it yet).
      //    - Once a submittable master document is copied, the original one is hidden for that participant/team.
      // 2. Personal copies (copied_from_id IS NOT NULL AND assigned_team_id IS NULL):
      //    - Strictly private to their creator.
      // 3. Team copies (copied_from_id IS NOT NULL AND assigned_team_id IS NOT NULL):
      //    - Visible only to members of that assigned team, or the copy creator.
      conditions.push(
        `(
          (
            d.copied_from_id IS NULL AND (
              (d.document_type != 'personal' OR d.created_by = ? OR d.is_submittable = 1)
              AND NOT (
                d.is_submittable = 1 AND d.created_by != ? AND (
                  (d.document_type = 'personal' AND EXISTS (SELECT 1 FROM documents WHERE copied_from_id = d.id AND created_by = ?))
                  OR
                  (d.document_type != 'personal' AND EXISTS (SELECT 1 FROM documents WHERE copied_from_id = d.id AND assigned_team_id IN (SELECT team_id FROM organization_team_members WHERE user_id = ?)))
                )
              )
            )
          )
          OR
          (d.copied_from_id IS NOT NULL AND d.assigned_team_id IS NULL AND d.created_by = ?)
          OR
          (d.copied_from_id IS NOT NULL AND d.assigned_team_id IS NOT NULL AND (
            d.created_by = ? OR d.assigned_team_id IN (SELECT team_id FROM organization_team_members WHERE user_id = ?)
          ))
        )`
      );
      params.push(userId, userId, userId, userId, userId, userId, userId);
    } else {
      conditions.push('1 = 0');
    }

    if (scope === 'personal' || targetOrgId === 'personal' || targetOrgId === 'null') {
      if (userId) {
        conditions.push(
          `((d.organization_id IS NULL AND d.created_by = ?) OR d.organization_id = (SELECT id FROM organizations WHERE name = ? AND created_by = ? LIMIT 1))`
        );
        params.push(userId, `${req.user?.username}_workspace`, userId);
      }
    } else if (targetOrgId && typeof targetOrgId === 'string') {
      if (userId && req.user?.username) {
        conditions.push(
          `((d.organization_id = ?) OR (d.organization_id IS NULL AND d.created_by = ? AND ? = (SELECT id FROM organizations WHERE name = ? AND created_by = ? LIMIT 1)))`
        );
        params.push(targetOrgId, userId, targetOrgId, `${req.user.username}_workspace`, userId);
      } else {
        conditions.push('d.organization_id = ?');
        params.push(targetOrgId);
      }
    }

    if (project_id && typeof project_id === 'string') {
      conditions.push('d.project_id = ?');
      params.push(project_id);
    }

    if (template_id && typeof template_id === 'string') {
      conditions.push('d.template_id = ?');
      params.push(template_id);
    }

    if (document_type && typeof document_type === 'string') {
      conditions.push('d.document_type = ?');
      params.push(document_type);
    }

    if (is_submittable !== undefined) {
      const isSubm = is_submittable === 'true' || is_submittable === '1';
      conditions.push('d.is_submittable = ?');
      params.push(isSubm ? 1 : 0);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(d.title) LIKE ? OR LOWER(d.author) LIKE ?)');
      params.push(q, q);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY d.updated_at DESC';

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
    const [rows] = await pool.query<any[]>(
      `SELECT d.*,
         u.name as creator_name,
         u.username as creator_username,
         p.association_type as project_association_type,
         ot.name as assigned_team_name,
         (SELECT COUNT(*) FROM document_submissions WHERE (document_id = d.id OR document_id IN (SELECT id FROM documents WHERE copied_from_id = d.id)) AND status = 'submitted') as submissions_count,
         (SELECT COUNT(*) FROM documents WHERE copied_from_id = d.id) as copies_count,
         (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       LEFT JOIN organization_teams ot ON d.assigned_team_id = ot.id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(formatDocumentRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve document', detail: err.message });
  }
});

// POST /api/v1/documents - Create document in project/organization or personal
documentsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      title,
      template_id,
      project_id,
      organization_id,
      team_id,
      author,
      tags,
      elements_data,
      document_type,
      is_submittable,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Document title is required' });
    }

    if (!template_id || typeof template_id !== 'string') {
      return res.status(400).json({ error: 'Valid template_id is required' });
    }

    let resolvedOrgId: string | null = null;
    let projAssociationType: string | null = null;
    const directOrgId = organization_id || team_id;

    if (project_id) {
      const [projRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [project_id]);
      if (!projRows || projRows.length === 0) {
        return res.status(400).json({ error: 'Selected project not found' });
      }
      const proj = projRows[0];
      resolvedOrgId = proj.organization_id || proj.team_id || null;
      projAssociationType = proj.association_type || 'individual';

      if (resolvedOrgId) {
        const isMember = await isOrganizationMember(user.id, resolvedOrgId);
        if (!isMember) {
          return res.status(403).json({ error: 'You are not a member of the organization for this project' });
        }

        const creationPerm = proj.document_creation_permission || 'all_members';
        if (creationPerm === 'creator_only') {
          const isProjCreator = proj.created_by === user.id;
          const isOrgCreator = await isOrganizationCreator(user.id, resolvedOrgId);
          if (!isProjCreator && !isOrgCreator) {
            return res.status(403).json({
              error: 'Only the project creator can create documents in this project',
            });
          }
        }
      } else if (proj.created_by !== user.id) {
        return res.status(403).json({ error: 'You do not have access to this personal project' });
      }
    } else if (directOrgId) {
      resolvedOrgId = String(directOrgId);
      const isMember = await isOrganizationMember(user.id, resolvedOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the selected organization' });
      }
    }

    // Fetch template details
    const template = await fetchTemplateById(template_id);
    if (!template) {
      return res.status(400).json({ error: `Template with ID '${template_id}' not found` });
    }

    // Initialize elements data
    const finalElementsData: Record<string, any> = {};
    for (const elem of template.document_elements) {
      if (elements_data && elements_data[elem.id] !== undefined) {
        finalElementsData[elem.id] = elements_data[elem.id];
      } else {
        const isIterative =
          elem.field_type === 'iteration_container' ||
          elem.field_type === 'iteration_group' ||
          elem.field_type === 'interactive_list' ||
          elem.field_type === 'repeatable_list' ||
          Boolean(elem.container_children && elem.container_children.length > 0) ||
          Boolean(elem.iteration_fields && elem.iteration_fields.length > 0);
        if (isIterative) {
          let containerChildren: any[] = [];
          if (elem.container_children && elem.container_children.length > 0) {
            containerChildren = elem.container_children;
          } else if (elem.iteration_fields && elem.iteration_fields.length > 0) {
            containerChildren = elem.iteration_fields.map((f: any, fIdx: number) => ({
              id: f.id || `field_${fIdx + 1}`,
              type: 'key_value',
              key: f.key,
              label: f.label || f.key,
              description: f.description,
              placeholder: f.placeholder,
              default_value: f.default_value,
            }));
          } else {
            containerChildren = [
              { id: 'reason', type: 'key_value', key: 'Reason', label: 'Reason', description: 'Explanation or root cause', placeholder: 'Enter reason...' },
              { id: 'todo', type: 'key_value', key: 'Todo', label: 'Todo', description: 'Action items to be taken', placeholder: 'Enter action items...' },
              { id: 'response', type: 'key_value', key: 'Response', label: 'Response', description: 'Observed outcome or system response', placeholder: 'Enter response...' },
            ];
          }

          if (Array.isArray(elem.default_value) && elem.default_value.length > 0) {
            finalElementsData[elem.id] = elem.default_value;
          } else {
            const vals: Record<string, any> = {};
            for (const c of containerChildren) {
              const k = c.key || c.id;
              vals[k] = c.default_value || '';
              if (c.id && c.id !== k) {
                vals[c.id] = c.default_value || '';
              }
            }
            finalElementsData[elem.id] = [
              {
                id: 'iter-1',
                iteration_number: 1,
                title: 'Iteration #1',
                values: vals,
                fields: containerChildren
                  .filter((c: any) => c.type === 'key_value')
                  .map((c: any) => ({ key: c.key || c.id, value: vals[c.key || c.id] || '' })),
              },
            ];
          }
        } else {
          finalElementsData[elem.id] = elem.default_value || '';
        }
      }
    }

    const docId = `doc-${crypto.randomBytes(4).toString('hex')}`;
    const cleanAuthor = (author && typeof author === 'string' && author.trim()) || user.name || user.username;
    const cleanTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
    const status = 'draft';

    // Standalone documents (no project) or projects with individual association are strictly personal documents
    if (project_id && projAssociationType === 'individual') {
      if (document_type === 'project_shared') {
        return res.status(400).json({ error: 'Projects with individual assignments only support personal documents' });
      }
    }
    const docType: DocumentType = (!project_id || (project_id && projAssociationType === 'individual'))
      ? 'personal'
      : (document_type === 'personal' ? 'personal' : 'project_shared');
    const isSubm = Boolean(is_submittable);

    const compiledMd = compileDocumentMarkdown(
      title.trim(),
      status,
      cleanAuthor,
      cleanTags,
      template,
      finalElementsData
    );

    await pool.query(
      `INSERT INTO documents (id, title, project_id, organization_id, template_id, template_title, document_type, is_submittable, status, author, created_by, last_edited_by, tags, elements_data, compiled_markdown, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        docId,
        title.trim(),
        project_id || null,
        resolvedOrgId,
        template.id,
        template.title,
        docType,
        isSubm,
        status,
        cleanAuthor,
        user.id,
        user.id,
        JSON.stringify(cleanTags),
        JSON.stringify(finalElementsData),
        compiledMd,
      ]
    );

    const [createdRows] = await pool.query<any[]>(
      `SELECT d.*,
         u.name as creator_name,
         u.username as creator_username,
         p.association_type as project_association_type,
         0 as submissions_count
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = ?`,
      [docId]
    );
    res.status(201).json(formatDocumentRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create document', detail: err.message });
  }
});

// PUT /api/v1/documents/:id - Update document
documentsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const [existing] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentDoc = existing[0];
    const docOrgId = currentDoc.organization_id || currentDoc.team_id;

    // Verify user is a member of the organization if document belongs to an organization
    if (docOrgId) {
      const isMember = await isOrganizationMember(user.id, docOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the organization for this document' });
      }
    }

    const { title, status, author, tags, elements_data, project_id, document_type, is_submittable } = req.body;

    // Only the document creator can edit master submittable documents or non-submittable personal documents
    const isDocCreator = !currentDoc.created_by || user.id === currentDoc.created_by;
    const isMasterSubmittable = currentDoc.is_submittable && !currentDoc.copied_from_id;

    if (isMasterSubmittable && !isDocCreator) {
      const isMgr = docOrgId ? await isOrganizationManager(user.id, docOrgId) : false;
      if (!isMgr) {
        return res.status(403).json({
          error: currentDoc.document_type === 'personal'
            ? 'Personal documents can only be edited by their creator'
            : 'Only the creator can edit the master specification. Your team must work on its team copy.',
        });
      }
    }

    if (currentDoc.document_type === 'personal' && !isDocCreator) {
      const isMgr = docOrgId ? await isOrganizationManager(user.id, docOrgId) : false;
      if (!isMgr) {
        return res.status(403).json({ error: 'Personal documents can only be edited by their creator' });
      }
    }

    // Team copy authorization check: only members of the assigned team can edit this team copy
    if (currentDoc.copied_from_id && currentDoc.assigned_team_id) {
      const [membership] = await pool.query<any[]>(
        'SELECT 1 FROM organization_team_members WHERE team_id = ? AND user_id = ?',
        [currentDoc.assigned_team_id, user.id]
      );
      const isTeamMember = membership && membership.length > 0;
      const isCopyCreator = currentDoc.created_by === user.id;
      const isMgr = docOrgId ? await isOrganizationManager(user.id, docOrgId) : false;
      if (!isTeamMember && !isCopyCreator && !isMgr) {
        return res.status(403).json({
          error: 'You do not belong to the team assigned to this document copy.',
        });
      }
    }

    if (!isDocCreator) {
      if (document_type !== undefined && document_type !== currentDoc.document_type) {
        return res.status(403).json({ error: 'Only the document creator can change the collaboration type' });
      }
      if (is_submittable !== undefined && Boolean(is_submittable) !== Boolean(currentDoc.is_submittable)) {
        return res.status(403).json({ error: 'Only the document creator can enable or disable submissions' });
      }
    }

    const newTitle = title !== undefined && typeof title === 'string' ? title.trim() : currentDoc.title;
    const newStatus = status !== undefined ? status : currentDoc.status;
    const newAuthor = author !== undefined ? author : currentDoc.author;
    const newProjectId = project_id !== undefined ? project_id : currentDoc.project_id;

    let projAssociationType: string | null = null;
    if (newProjectId) {
      const [projRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [newProjectId]);
      if (!projRows || projRows.length === 0) {
        return res.status(400).json({ error: 'Target project not found' });
      }
      const targetProj = projRows[0];
      projAssociationType = targetProj.association_type || 'individual';

      if (newProjectId !== currentDoc.project_id) {
        const targetOrgId = targetProj.organization_id || targetProj.team_id;
        if (targetOrgId) {
          const isMember = await isOrganizationMember(user.id, targetOrgId);
          if (!isMember) {
            return res.status(403).json({ error: 'You are not a member of the organization for this project' });
          }
          const creationPerm = targetProj.document_creation_permission || 'all_members';
          if (creationPerm === 'creator_only') {
            const isProjCreator = targetProj.created_by === user.id;
            const isOrgCreator = await isOrganizationCreator(user.id, targetOrgId);
            if (!isProjCreator && !isOrgCreator) {
              return res.status(403).json({
                error: 'Only the project creator can add documents to this creator-only project',
              });
            }
          }
        } else if (targetProj.created_by !== user.id) {
          return res.status(403).json({ error: 'You do not have access to this personal project' });
        }
      }
    }

    if (newProjectId && projAssociationType === 'individual') {
      if (document_type === 'project_shared') {
        return res.status(400).json({ error: 'Projects with individual assignments only support personal documents' });
      }
    }

    let newDocType: DocumentType = isDocCreator && document_type !== undefined
      ? (document_type === 'personal' ? 'personal' : 'project_shared')
      : currentDoc.document_type || 'project_shared';

    if (newProjectId && projAssociationType === 'individual') {
      newDocType = 'personal';
    }

    const newIsSubmittable = isDocCreator && is_submittable !== undefined
      ? Boolean(is_submittable)
      : Boolean(currentDoc.is_submittable);

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
    const template = await fetchTemplateById(currentDoc.template_id);

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
       SET title = ?, status = ?, author = ?, project_id = ?, document_type = ?, is_submittable = ?, last_edited_by = ?, tags = ?, elements_data = ?, compiled_markdown = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        newTitle,
        newStatus,
        newAuthor,
        newProjectId,
        newDocType,
        newIsSubmittable,
        user.id,
        JSON.stringify(newTags),
        JSON.stringify(finalElementsData),
        compiledMd,
        id,
      ]
    );

    // If this document is a copy, keep document_submissions in sync for the creator's review roster
    if (currentDoc.copied_from_id) {
      const masterDocId = currentDoc.copied_from_id;
      if (currentDoc.assigned_team_id) {
        // Team copy sync:
        const [existingSubm] = await pool.query<any[]>(
          'SELECT id FROM document_submissions WHERE document_id = ? AND team_id = ?',
          [masterDocId, currentDoc.assigned_team_id]
        );
        if (existingSubm && existingSubm.length > 0) {
          await pool.query(
            `UPDATE document_submissions
             SET elements_data = ?, compiled_markdown = ?, updated_at = NOW()
             WHERE id = ?`,
            [JSON.stringify(finalElementsData), compiledMd, existingSubm[0].id]
          );
        } else {
          const submId = `subm-${crypto.randomBytes(4).toString('hex')}`;
          await pool.query(
            `INSERT INTO document_submissions (id, document_id, project_id, submission_type, user_id, team_id, status, elements_data, compiled_markdown, created_at, updated_at)
             VALUES (?, ?, ?, 'team', ?, ?, 'draft', ?, ?, NOW(), NOW())`,
            [
              submId,
              masterDocId,
              newProjectId || '',
              user.id,
              currentDoc.assigned_team_id,
              JSON.stringify(finalElementsData),
              compiledMd,
            ]
          );
        }
      } else {
        // Personal copy sync:
        const [existingSubm] = await pool.query<any[]>(
          'SELECT id FROM document_submissions WHERE document_id = ? AND user_id = ?',
          [masterDocId, user.id]
        );
        if (existingSubm && existingSubm.length > 0) {
          await pool.query(
            `UPDATE document_submissions
             SET elements_data = ?, compiled_markdown = ?, updated_at = NOW()
             WHERE id = ?`,
            [JSON.stringify(finalElementsData), compiledMd, existingSubm[0].id]
          );
        } else {
          const submId = `subm-${crypto.randomBytes(4).toString('hex')}`;
          await pool.query(
            `INSERT INTO document_submissions (id, document_id, project_id, submission_type, user_id, team_id, status, elements_data, compiled_markdown, created_at, updated_at)
             VALUES (?, ?, ?, 'personal', ?, NULL, 'draft', ?, ?, NOW(), NOW())`,
            [
              submId,
              masterDocId,
              newProjectId || '',
              user.id,
              JSON.stringify(finalElementsData),
              compiledMd,
            ]
          );
        }
      }
    }

    const [updatedRows] = await pool.query<any[]>(
      `SELECT d.*,
         u.name as creator_name,
         u.username as creator_username,
         p.association_type as project_association_type,
         ot.name as assigned_team_name,
         (SELECT COUNT(*) FROM document_submissions WHERE (document_id = d.id OR document_id IN (SELECT id FROM documents WHERE copied_from_id = d.id)) AND status = 'submitted') as submissions_count,
         (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       LEFT JOIN organization_teams ot ON d.assigned_team_id = ot.id
       WHERE d.id = ?`,
      [id]
    );
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
    const docOrgId = doc.organization_id || doc.team_id;
    if (docOrgId) {
      const isMember = await isOrganizationMember(user.id, docOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You do not have permission to delete this document' });
      }
    }

    const isDocCreator = !doc.created_by || user.id === doc.created_by;
    const isMgr = docOrgId ? await isOrganizationManager(user.id, docOrgId) : false;

    if (doc.copied_from_id && doc.assigned_team_id) {
      const [membership] = await pool.query<any[]>(
        'SELECT 1 FROM organization_team_members WHERE team_id = ? AND user_id = ?',
        [doc.assigned_team_id, user.id]
      );
      const isTeamMember = membership && membership.length > 0;
      if (!isTeamMember && !isDocCreator && !isMgr) {
        return res.status(403).json({ error: 'You do not belong to the team assigned to this document copy' });
      }
    } else if (!isDocCreator && !isMgr) {
      return res.status(403).json({ error: 'Only the document creator can delete this document' });
    }

    // Condition (1): If this is a submittable doc (enable submission), check if copies have been created
    if (Boolean(doc.is_submittable)) {
      const [copyRows] = await pool.query<any[]>(
        'SELECT COUNT(*) as count FROM documents WHERE copied_from_id = ?',
        [doc.id]
      );
      const copiesCount = Number(copyRows[0]?.count || 0);
      if (copiesCount > 0) {
        return res.status(400).json({
          error: 'This document cannot be deleted because copies have already been created.',
          copies_count: copiesCount,
        });
      }
    }

    // Cascade delete comments and submissions
    await pool.query(
      'DELETE FROM submission_comments WHERE submission_id IN (SELECT id FROM document_submissions WHERE document_id = ?)',
      [req.params.id]
    );
    await pool.query('DELETE FROM document_submissions WHERE document_id = ?', [req.params.id]);
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

// POST /api/v1/documents/:id/copy - Copy a submittable doc (personal or team) into an independent instance
documentsRouter.post('/:id/copy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const [rows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const sourceDoc = rows[0];
    const docOrgId = sourceDoc.organization_id || sourceDoc.team_id;

    if (docOrgId) {
      const isMember = await isOrganizationMember(user.id, docOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the organization for this document' });
      }
    }

    if (!sourceDoc.is_submittable) {
      return res.status(400).json({ error: 'Only submittable documents can be copied as deliverable instances' });
    }

    // If caller is the creator of the master document, return master document
    if (sourceDoc.created_by === user.id && !sourceDoc.copied_from_id) {
      const [creatorRows] = await pool.query<any[]>(
        `SELECT d.*,
           u.name as creator_name,
           u.username as creator_username,
           p.association_type as project_association_type,
           ot.name as assigned_team_name,
           (SELECT COUNT(*) FROM document_submissions WHERE (document_id = d.id OR document_id IN (SELECT id FROM documents WHERE copied_from_id = d.id)) AND status = 'submitted') as submissions_count,
           (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
         FROM documents d
         LEFT JOIN users u ON d.created_by = u.id
         LEFT JOIN projects p ON d.project_id = p.id
         LEFT JOIN organization_teams ot ON d.assigned_team_id = ot.id
         WHERE d.id = ?`,
        [id]
      );
      return res.json(formatDocumentRow(creatorRows[0]));
    }

    // Parse elements data from source document
    let sourceElementsData: Record<string, any> = {};
    if (typeof sourceDoc.elements_data === 'string') {
      try {
        sourceElementsData = JSON.parse(sourceDoc.elements_data);
      } catch {
        sourceElementsData = {};
      }
    } else if (typeof sourceDoc.elements_data === 'object' && sourceDoc.elements_data !== null) {
      sourceElementsData = { ...sourceDoc.elements_data };
    }

    let sourceTags: string[] = [];
    if (typeof sourceDoc.tags === 'string') {
      try {
        sourceTags = JSON.parse(sourceDoc.tags);
      } catch {
        sourceTags = [];
      }
    } else if (Array.isArray(sourceDoc.tags)) {
      sourceTags = sourceDoc.tags;
    }

    const template = await fetchTemplateById(sourceDoc.template_id);

    const masterDocId = sourceDoc.copied_from_id || sourceDoc.id;

    // =========================================================================
    // BRANCH A: Personal Document Copy
    // =========================================================================
    if (sourceDoc.document_type === 'personal') {
      // Check if user already has an existing copy of this master document
      const [existingCopies] = await pool.query<any[]>(
        `SELECT d.*,
           u.name as creator_name,
           u.username as creator_username,
           p.association_type as project_association_type,
           NULL as assigned_team_name,
           0 as submissions_count
         FROM documents d
         LEFT JOIN users u ON d.created_by = u.id
         LEFT JOIN projects p ON d.project_id = p.id
         WHERE d.copied_from_id = ? AND d.created_by = ?`,
        [masterDocId, user.id]
      );

      if (existingCopies && existingCopies.length > 0) {
        return res.json(formatDocumentRow(existingCopies[0]));
      }

      const authorLabel = user.name || user.username;
      const newDocId = `doc-${crypto.randomBytes(4).toString('hex')}`;
      const compiledMd = compileDocumentMarkdown(
        sourceDoc.title,
        'draft',
        authorLabel,
        sourceTags,
        template,
        sourceElementsData
      );

      await pool.query(
        `INSERT INTO documents (id, title, project_id, organization_id, template_id, template_title, document_type, is_submittable, status, author, created_by, last_edited_by, tags, elements_data, compiled_markdown, copied_from_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'personal', TRUE, 'draft', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          newDocId,
          sourceDoc.title,
          sourceDoc.project_id || null,
          sourceDoc.organization_id || null,
          sourceDoc.template_id,
          sourceDoc.template_title,
          authorLabel,
          user.id,
          user.id,
          JSON.stringify(sourceTags),
          JSON.stringify(sourceElementsData),
          compiledMd,
          masterDocId,
        ]
      );

      // Ensure document_submissions row exists for creator's review roster
      const [submExists] = await pool.query<any[]>(
        'SELECT id FROM document_submissions WHERE document_id = ? AND user_id = ?',
        [masterDocId, user.id]
      );
      if (!submExists || submExists.length === 0) {
        const submId = `subm-${crypto.randomBytes(4).toString('hex')}`;
        await pool.query(
          `INSERT INTO document_submissions (id, document_id, project_id, submission_type, user_id, team_id, status, elements_data, compiled_markdown, created_at, updated_at)
           VALUES (?, ?, ?, 'personal', ?, NULL, 'draft', ?, ?, NOW(), NOW())`,
          [
            submId,
            masterDocId,
            sourceDoc.project_id || '',
            user.id,
            JSON.stringify(sourceElementsData),
            compiledMd,
          ]
        );
      }

      const [createdRows] = await pool.query<any[]>(
        `SELECT d.*,
           u.name as creator_name,
           u.username as creator_username,
           p.association_type as project_association_type,
           NULL as assigned_team_name,
           0 as submissions_count,
           (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
         FROM documents d
         LEFT JOIN users u ON d.created_by = u.id
         LEFT JOIN projects p ON d.project_id = p.id
         WHERE d.id = ?`,
        [newDocId]
      );

      return res.status(201).json(formatDocumentRow(createdRows[0]));
    }

    // =========================================================================
    // BRANCH B: Project Shared Document (Team-Based Shared Copy)
    // "Whoever in the team firstly open a document must create a copy for the team to share editing."
    // =========================================================================
    if (!sourceDoc.project_id) {
      return res.status(400).json({ error: 'Team shared documents must belong to a project to determine assigned teams' });
    }

    // Determine the caller's team in this project
    const [teamRows] = await pool.query<any[]>(
      `SELECT otm.team_id, ot.name as team_name
       FROM organization_team_members otm
       JOIN project_team_assignments pta ON otm.team_id = pta.team_id
       JOIN organization_teams ot ON otm.team_id = ot.id
       WHERE pta.project_id = ? AND otm.user_id = ?
       LIMIT 1`,
      [sourceDoc.project_id, user.id]
    );

    let targetTeamId: string;
    let targetTeamName: string;

    if (teamRows && teamRows.length > 0) {
      targetTeamId = teamRows[0].team_id;
      targetTeamName = teamRows[0].team_name;
    } else {
      // Check if user is organization manager and can test with first assigned team
      const isMgr = docOrgId ? await isOrganizationManager(user.id, docOrgId) : false;
      if (isMgr) {
        const [anyTeams] = await pool.query<any[]>(
          `SELECT ot.id as team_id, ot.name as team_name
           FROM project_team_assignments pta
           JOIN organization_teams ot ON pta.team_id = ot.id
           WHERE pta.project_id = ?
           LIMIT 1`,
          [sourceDoc.project_id]
        );
        if (anyTeams && anyTeams.length > 0) {
          targetTeamId = anyTeams[0].team_id;
          targetTeamName = anyTeams[0].team_name;
        } else {
          return res.status(400).json({ error: 'No teams have been assigned to this project yet.' });
        }
      } else {
        return res.status(403).json({
          error: 'You are not a member of any team assigned to this project.',
        });
      }
    }

    // Check if a copy ALREADY EXISTS for this team:
    // If ANY member of this team already opened it, return that shared team copy!
    const [existingTeamCopies] = await pool.query<any[]>(
      `SELECT d.*,
         u.name as creator_name,
         u.username as creator_username,
         p.association_type as project_association_type,
         ot.name as assigned_team_name,
         0 as submissions_count,
         (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       LEFT JOIN organization_teams ot ON d.assigned_team_id = ot.id
       WHERE d.copied_from_id = ? AND d.assigned_team_id = ?`,
      [sourceDoc.id, targetTeamId]
    );

    if (existingTeamCopies && existingTeamCopies.length > 0) {
      // Another member of this team (or this user) already created the copy - return it so they share editing!
      return res.json(formatDocumentRow(existingTeamCopies[0]));
    }

    // The caller is the first person in their team to open it!
    // Create the team copy:
    const newDocId = `doc-${crypto.randomBytes(4).toString('hex')}`;
    const authorLabel = `${targetTeamName}`;
    const compiledMd = compileDocumentMarkdown(
      sourceDoc.title,
      'draft',
      authorLabel,
      sourceTags,
      template,
      sourceElementsData
    );

    await pool.query(
      `INSERT INTO documents (id, title, project_id, organization_id, template_id, template_title, document_type, is_submittable, status, author, created_by, last_edited_by, tags, elements_data, compiled_markdown, copied_from_id, assigned_team_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'project_shared', TRUE, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        newDocId,
        sourceDoc.title,
        sourceDoc.project_id,
        sourceDoc.organization_id || null,
        sourceDoc.template_id,
        sourceDoc.template_title,
        authorLabel,
        user.id,
        user.id,
        JSON.stringify(sourceTags),
        JSON.stringify(sourceElementsData),
        compiledMd,
        masterDocId,
        targetTeamId,
      ]
    );

    // Also ensure team submission draft exists in document_submissions
    const [submExists] = await pool.query<any[]>(
      'SELECT id FROM document_submissions WHERE document_id = ? AND team_id = ?',
      [masterDocId, targetTeamId]
    );
    if (!submExists || submExists.length === 0) {
      const submId = `subm-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO document_submissions (id, document_id, project_id, submission_type, user_id, team_id, status, elements_data, compiled_markdown, created_at, updated_at)
         VALUES (?, ?, ?, 'team', ?, ?, 'draft', ?, ?, NOW(), NOW())`,
        [
          submId,
          masterDocId,
          sourceDoc.project_id,
          user.id,
          targetTeamId,
          JSON.stringify(sourceElementsData),
          compiledMd,
        ]
      );
    }

    const [createdRows] = await pool.query<any[]>(
      `SELECT d.*,
         u.name as creator_name,
         u.username as creator_username,
         p.association_type as project_association_type,
         ot.name as assigned_team_name,
         0 as submissions_count,
         (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       LEFT JOIN organization_teams ot ON d.assigned_team_id = ot.id
       WHERE d.id = ?`,
      [newDocId]
    );

    return res.status(201).json(formatDocumentRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to copy document', detail: err.message });
  }
});

// ==============================================================================
// Document Submissions & Creator Review Endpoints
// ==============================================================================

// Helper: Check if user is document creator, organization owner or manager
async function canReviewSubmissions(userId: string, doc: any, project: any): Promise<boolean> {
  // 1. Primary: Document creator can review all submissions
  if (doc.created_by && doc.created_by === userId) return true;
  // If this doc is a copy, check if user is the creator of the master document
  if (doc.copied_from_id) {
    try {
      const [mRows] = await pool.query<any[]>('SELECT created_by, organization_id, project_id FROM documents WHERE id = ?', [doc.copied_from_id]);
      if (mRows && mRows.length > 0 && mRows[0].created_by === userId) return true;
    } catch {}
  }
  // 2. Legacy fallback: If document has no recorded creator, check project creator
  if (!doc.created_by && project && project.created_by === userId) return true;
  // 3. Administrative oversight: Organization owner or manager
  const orgId = doc.organization_id || doc.team_id || (project ? (project.organization_id || project.team_id) : null);
  if (orgId) {
    return isOrganizationManager(userId, orgId);
  }
  return false;
}

// GET /api/v1/documents/:id/submissions - List all submissions for project creator, or own submission for participants
documentsRouter.get('/:id/submissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docRows || docRows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docRows[0];
    const docId = doc.copied_from_id || doc.id;
    if (!doc.is_submittable) {
      return res.json([]);
    }

    let project: any = null;
    if (doc.project_id) {
      const [projRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [doc.project_id]);
      if (projRows && projRows.length > 0) {
        project = projRows[0];
      }
    }

    const isReviewer = await canReviewSubmissions(userId, doc, project);
    const docType: DocumentType =
      (project && project.association_type === 'individual')
        ? 'personal'
        : (doc.document_type === 'personal' ? 'personal' : 'project_shared');

    if (isReviewer) {
      // Reviewer view: list all expected submissions
      if (docType === 'personal') {
        // Collect expected users
        const usersMap = new Map<string, { user_id: string; user_name: string; user_email: string }>();

        if (project) {
          if (project.association_type === 'individual') {
            const [indivs] = await pool.query<any[]>(
              `SELECT pim.user_id, u.name, u.username, u.email
               FROM project_individual_members pim
               JOIN users u ON pim.user_id = u.id
               WHERE pim.project_id = ?`,
              [project.id]
            );
            for (const row of indivs) {
              usersMap.set(row.user_id, {
                user_id: row.user_id,
                user_name: row.name || row.username,
                user_email: row.email,
              });
            }
          } else {
            // Team association: users across all assigned teams
            const [teamUsers] = await pool.query<any[]>(
              `SELECT DISTINCT otm.user_id, u.name, u.username, u.email
               FROM organization_team_members otm
               JOIN project_team_assignments pta ON otm.team_id = pta.team_id
               JOIN users u ON otm.user_id = u.id
               WHERE pta.project_id = ?`,
              [project.id]
            );
            for (const row of teamUsers) {
              usersMap.set(row.user_id, {
                user_id: row.user_id,
                user_name: row.name || row.username,
                user_email: row.email,
              });
            }
          }
        }

        // Also fetch any users who already submitted
        const [existingSubmUsers] = await pool.query<any[]>(
          `SELECT DISTINCT ds.user_id, u.name, u.username, u.email
           FROM document_submissions ds
           JOIN users u ON ds.user_id = u.id
           WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?)) AND ds.user_id IS NOT NULL`,
          [docId, docId]
        );
        for (const row of existingSubmUsers) {
          if (!usersMap.has(row.user_id)) {
            usersMap.set(row.user_id, {
              user_id: row.user_id,
              user_name: row.name || row.username,
              user_email: row.email,
            });
          }
        }

        // Fetch all submission records for this document
        const [submissions] = await pool.query<any[]>(
          `SELECT ds.*, u.name as user_name, u.username, u.email as user_email,
             (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
           FROM document_submissions ds
           LEFT JOIN users u ON ds.user_id = u.id
           WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?))`,
          [docId, docId]
        );
        const submsByUserId = new Map<string, any>();
        for (const s of submissions) {
          if (s.user_id) submsByUserId.set(s.user_id, s);
        }

        const results: DocumentSubmission[] = [];
        for (const [uId, uInfo] of usersMap.entries()) {
          const s = submsByUserId.get(uId);
          if (s) {
            results.push(formatSubmissionRow(s));
          } else {
            results.push({
              id: `placeholder-${uId}`,
              document_id: docId,
              project_id: doc.project_id || '',
              submission_type: 'personal',
              user_id: uId,
              user_name: uInfo.user_name,
              user_email: uInfo.user_email,
              status: 'not_started',
              elements_data: {},
              compiled_markdown: '',
              submitted_at: null,
              created_at: new Date(doc.created_at).toISOString(),
              updated_at: new Date(doc.created_at).toISOString(),
              comments_count: 0,
              comments: [],
            });
          }
        }

        return res.json(results);
      } else {
        // Project Shared Document: Team-based submissions
        const teamsMap = new Map<string, { team_id: string; team_name: string }>();

        if (project) {
          const [assignedTeams] = await pool.query<any[]>(
            `SELECT ot.id as team_id, ot.name as team_name
             FROM project_team_assignments pta
             JOIN organization_teams ot ON pta.team_id = ot.id
             WHERE pta.project_id = ?`,
            [project.id]
          );
          for (const row of assignedTeams) {
            teamsMap.set(row.team_id, { team_id: row.team_id, team_name: row.team_name });
          }
        }

        // Also fetch any teams with existing submission records
        const [existingSubmTeams] = await pool.query<any[]>(
          `SELECT DISTINCT ds.team_id, ot.name as team_name
           FROM document_submissions ds
           JOIN organization_teams ot ON ds.team_id = ot.id
           WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?)) AND ds.team_id IS NOT NULL`,
          [docId, docId]
        );
        for (const row of existingSubmTeams) {
          if (!teamsMap.has(row.team_id)) {
            teamsMap.set(row.team_id, { team_id: row.team_id, team_name: row.team_name });
          }
        }

        const [submissions] = await pool.query<any[]>(
          `SELECT ds.*, ot.name as team_name,
             (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
           FROM document_submissions ds
           LEFT JOIN organization_teams ot ON ds.team_id = ot.id
           WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?))`,
          [docId, docId]
        );
        const submsByTeamId = new Map<string, any>();
        for (const s of submissions) {
          if (s.team_id) submsByTeamId.set(s.team_id, s);
        }

        const results: DocumentSubmission[] = [];
        for (const [tId, tInfo] of teamsMap.entries()) {
          const s = submsByTeamId.get(tId);
          if (s) {
            results.push(formatSubmissionRow(s));
          } else {
            results.push({
              id: `placeholder-${tId}`,
              document_id: docId,
              project_id: doc.project_id || '',
              submission_type: 'team',
              team_id: tId,
              team_name: tInfo.team_name,
              status: 'not_started',
              elements_data: {},
              compiled_markdown: '',
              submitted_at: null,
              created_at: new Date(doc.created_at).toISOString(),
              updated_at: new Date(doc.created_at).toISOString(),
              comments_count: 0,
              comments: [],
            });
          }
        }

        return res.json(results);
      }
    } else {
      // Participant view: only return caller's own submission or team's submission
      if (docType === 'personal') {
        const [rows] = await pool.query<any[]>(
          `SELECT ds.*, u.name as user_name, u.username, u.email as user_email,
             (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
           FROM document_submissions ds
           LEFT JOIN users u ON ds.user_id = u.id
           WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?)) AND ds.user_id = ?`,
          [docId, docId, userId]
        );
        return res.json(rows.map((r) => formatSubmissionRow(r)));
      } else {
        // Find user's team in project
        const [teamRows] = await pool.query<any[]>(
          `SELECT otm.team_id, ot.name as team_name
           FROM organization_team_members otm
           JOIN project_team_assignments pta ON otm.team_id = pta.team_id
           JOIN organization_teams ot ON otm.team_id = ot.id
           WHERE pta.project_id = ? AND otm.user_id = ?`,
          [doc.project_id, userId]
        );
        const teamIds = teamRows.map((r) => r.team_id);
        if (teamIds.length === 0) {
          return res.json([]);
        }
        const [rows] = await pool.query<any[]>(
          `SELECT ds.*, ot.name as team_name,
             (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
           FROM document_submissions ds
           LEFT JOIN organization_teams ot ON ds.team_id = ot.id
           WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?)) AND ds.team_id IN (?)`,
          [docId, docId, teamIds]
        );
        return res.json(rows.map((r) => formatSubmissionRow(r)));
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve submissions', detail: err.message });
  }
});

// GET /api/v1/documents/:id/my-submission - Get or pre-populate draft submission for caller
documentsRouter.get('/:id/my-submission', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docRows || docRows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docRows[0];
    const docId = doc.copied_from_id || doc.id;
    if (!doc.is_submittable) {
      return res.status(400).json({ error: 'This document is not configured for submissions' });
    }

    let project: any = null;
    if (doc.project_id) {
      const [projRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [doc.project_id]);
      if (projRows && projRows.length > 0) {
        project = projRows[0];
      }
    }

    const docType: DocumentType =
      (project && project.association_type === 'individual')
        ? 'personal'
        : (doc.document_type === 'personal' ? 'personal' : 'project_shared');
    const template = await fetchTemplateById(doc.template_id);

    // Initial elements data pre-populated with creator prompt & default values
    let prePopulatedData: Record<string, any> = {};
    if (typeof doc.elements_data === 'string') {
      try {
        prePopulatedData = JSON.parse(doc.elements_data);
      } catch {
        prePopulatedData = {};
      }
    } else if (typeof doc.elements_data === 'object' && doc.elements_data !== null) {
      prePopulatedData = { ...doc.elements_data };
    }

    if (template?.document_elements) {
      for (const elem of template.document_elements) {
        if (prePopulatedData[elem.id] === undefined || prePopulatedData[elem.id] === null || prePopulatedData[elem.id] === '') {
          const isIterative =
            elem.field_type === 'iteration_container' ||
            elem.field_type === 'iteration_group' ||
            elem.field_type === 'interactive_list' ||
            elem.field_type === 'repeatable_list' ||
            Boolean(elem.container_children && elem.container_children.length > 0) ||
            Boolean(elem.iteration_fields && elem.iteration_fields.length > 0);
          if (isIterative) {
            let containerChildren: any[] = [];
            if (elem.container_children && elem.container_children.length > 0) {
              containerChildren = elem.container_children;
            } else if (elem.iteration_fields && elem.iteration_fields.length > 0) {
              containerChildren = elem.iteration_fields.map((f: any, fIdx: number) => ({
                id: f.id || `field_${fIdx + 1}`,
                type: 'key_value',
                key: f.key,
                label: f.label || f.key,
                description: f.description,
                placeholder: f.placeholder,
                default_value: f.default_value,
              }));
            } else {
              containerChildren = [
                { id: 'reason', type: 'key_value', key: 'Reason', label: 'Reason', description: 'Explanation or root cause', placeholder: 'Enter reason...' },
                { id: 'todo', type: 'key_value', key: 'Todo', label: 'Todo', description: 'Action items to be taken', placeholder: 'Enter action items...' },
                { id: 'response', type: 'key_value', key: 'Response', label: 'Response', description: 'Observed outcome or system response', placeholder: 'Enter response...' },
              ];
            }

            if (Array.isArray(elem.default_value) && elem.default_value.length > 0) {
              prePopulatedData[elem.id] = elem.default_value;
            } else {
              const vals: Record<string, any> = {};
              for (const c of containerChildren) {
                const k = c.key || c.id;
                vals[k] = c.default_value || '';
                if (c.id && c.id !== k) {
                  vals[c.id] = c.default_value || '';
                }
              }
              prePopulatedData[elem.id] = [
                {
                  id: 'iter-1',
                  iteration_number: 1,
                  title: 'Iteration #1',
                  values: vals,
                  fields: containerChildren
                    .filter((c: any) => c.type === 'key_value')
                    .map((c: any) => ({ key: c.key || c.id, value: vals[c.key || c.id] || '' })),
                },
              ];
            }
          } else {
            prePopulatedData[elem.id] = elem.default_value || '';
          }
        }
      }
    }

    if (docType === 'personal') {
      // Look up existing submission
      const [existing] = await pool.query<any[]>(
        `SELECT ds.*, u.name as user_name, u.username, u.email as user_email
         FROM document_submissions ds
         LEFT JOIN users u ON ds.user_id = u.id
         WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?)) AND ds.user_id = ?`,
        [docId, docId, user.id]
      );

      if (existing && existing.length > 0) {
        const [comments] = await pool.query<any[]>(
          `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
           FROM submission_comments sc
           JOIN users u ON sc.user_id = u.id
           WHERE sc.submission_id = ?
           ORDER BY sc.created_at ASC`,
          [existing[0].id]
        );
        return res.json(formatSubmissionRow(existing[0], comments));
      }

      // Pre-populate new personal submission draft
      const submId = `subm-${crypto.randomBytes(4).toString('hex')}`;
      const authorLabel = user.name || user.username;
      const compiledMd = compileDocumentMarkdown(
        `${doc.title} - ${authorLabel}`,
        'draft',
        authorLabel,
        [],
        template,
        prePopulatedData
      );

      await pool.query(
        `INSERT INTO document_submissions (id, document_id, project_id, submission_type, user_id, team_id, status, elements_data, compiled_markdown, created_at, updated_at)
         VALUES (?, ?, ?, 'personal', ?, NULL, 'draft', ?, ?, NOW(), NOW())`,
        [
          submId,
          docId,
          doc.project_id || '',
          user.id,
          JSON.stringify(prePopulatedData),
          compiledMd,
        ]
      );

      const [created] = await pool.query<any[]>(
        `SELECT ds.*, u.name as user_name, u.username, u.email as user_email, 0 as comments_count
         FROM document_submissions ds
         LEFT JOIN users u ON ds.user_id = u.id
         WHERE ds.id = ?`,
        [submId]
      );
      return res.status(201).json(formatSubmissionRow(created[0], []));
    } else {
      // Team-based submission
      if (!doc.project_id) {
        return res.status(400).json({ error: 'Team submissions require a project context' });
      }

      const [teamRows] = await pool.query<any[]>(
        `SELECT otm.team_id, ot.name as team_name
         FROM organization_team_members otm
         JOIN project_team_assignments pta ON otm.team_id = pta.team_id
         JOIN organization_teams ot ON otm.team_id = ot.id
         WHERE pta.project_id = ? AND otm.user_id = ?
         LIMIT 1`,
        [doc.project_id, user.id]
      );

      let targetTeamId: string;
      let targetTeamName: string;

      if (teamRows && teamRows.length > 0) {
        targetTeamId = teamRows[0].team_id;
        targetTeamName = teamRows[0].team_name;
      } else {
        // If user is project creator, allow fallback to first assigned team or error
        const [anyTeams] = await pool.query<any[]>(
          `SELECT ot.id as team_id, ot.name as team_name
           FROM project_team_assignments pta
           JOIN organization_teams ot ON pta.team_id = ot.id
           WHERE pta.project_id = ?
           LIMIT 1`,
          [doc.project_id]
        );
        if (!anyTeams || anyTeams.length === 0) {
          return res.status(400).json({
            error: 'No teams have been assigned to this project yet. Please assign a team first.',
          });
        }
        targetTeamId = anyTeams[0].team_id;
        targetTeamName = anyTeams[0].team_name;
      }

      // Look up existing submission for team
      const [existing] = await pool.query<any[]>(
        `SELECT ds.*, ot.name as team_name
         FROM document_submissions ds
         LEFT JOIN organization_teams ot ON ds.team_id = ot.id
         WHERE (ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?)) AND ds.team_id = ?`,
        [docId, docId, targetTeamId]
      );

      if (existing && existing.length > 0) {
        const [comments] = await pool.query<any[]>(
          `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
           FROM submission_comments sc
           JOIN users u ON sc.user_id = u.id
           WHERE sc.submission_id = ?
           ORDER BY sc.created_at ASC`,
          [existing[0].id]
        );
        return res.json(formatSubmissionRow(existing[0], comments));
      }

      // Pre-populate new team submission draft
      const submId = `subm-${crypto.randomBytes(4).toString('hex')}`;
      const compiledMd = compileDocumentMarkdown(
        `${doc.title} - ${targetTeamName}`,
        'draft',
        targetTeamName,
        [],
        template,
        prePopulatedData
      );

      await pool.query(
        `INSERT INTO document_submissions (id, document_id, project_id, submission_type, user_id, team_id, status, elements_data, compiled_markdown, created_at, updated_at)
         VALUES (?, ?, ?, 'team', ?, ?, 'draft', ?, ?, NOW(), NOW())`,
        [
          submId,
          docId,
          doc.project_id,
          user.id,
          targetTeamId,
          JSON.stringify(prePopulatedData),
          compiledMd,
        ]
      );

      const [created] = await pool.query<any[]>(
        `SELECT ds.*, ot.name as team_name, 0 as comments_count
         FROM document_submissions ds
         LEFT JOIN organization_teams ot ON ds.team_id = ot.id
         WHERE ds.id = ?`,
        [submId]
      );
      return res.status(201).json(formatSubmissionRow(created[0], []));
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve or initialize submission', detail: err.message });
  }
});

// GET /api/v1/documents/:id/submissions/:submissionId - Get specific submission with comments
documentsRouter.get('/:id/submissions/:submissionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: docId, submissionId } = req.params;

    const [rows] = await pool.query<any[]>(
      `SELECT ds.*, u.name as user_name, u.username, u.email as user_email, ot.name as team_name
       FROM document_submissions ds
       LEFT JOIN users u ON ds.user_id = u.id
       LEFT JOIN organization_teams ot ON ds.team_id = ot.id
       WHERE ds.id = ? AND (ds.document_id = ? OR ds.document_id IN (SELECT copied_from_id FROM documents WHERE id = ?) OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?))`,
      [submissionId, docId, docId, docId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const [comments] = await pool.query<any[]>(
      `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.submission_id = ?
       ORDER BY sc.created_at ASC`,
      [submissionId]
    );

    res.json(formatSubmissionRow(rows[0], comments));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve submission', detail: err.message });
  }
});

// PUT /api/v1/documents/:id/submissions/:submissionId - Update submission elements data
documentsRouter.put('/:id/submissions/:submissionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id: docId, submissionId } = req.params;
    const { elements_data } = req.body;

    const [existing] = await pool.query<any[]>(
      `SELECT ds.*, d.template_id, d.title as doc_title
       FROM document_submissions ds
       JOIN documents d ON ds.document_id = d.id
       WHERE ds.id = ? AND (ds.document_id = ? OR ds.document_id IN (SELECT copied_from_id FROM documents WHERE id = ?) OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?))`,
      [submissionId, docId, docId, docId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const subm = existing[0];

    let docObj: any = null;
    let projObj: any = null;
    if (subm.document_id) {
      const [dRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [subm.document_id]);
      if (dRows && dRows.length > 0) docObj = dRows[0];
    }
    if (subm.project_id) {
      const [pRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [subm.project_id]);
      if (pRows && pRows.length > 0) projObj = pRows[0];
    }

    // Verify permission: author of personal submission, or member of team submission
    if (subm.submission_type === 'personal') {
      if (subm.user_id !== user.id) {
        const isMgr = await canReviewSubmissions(user.id, docObj || subm, projObj);
        if (!isMgr) {
          return res.status(403).json({ error: 'You do not have permission to edit this personal submission' });
        }
      }
    } else {
      // Team submission: verify user is in team
      const [inTeam] = await pool.query<any[]>(
        'SELECT COUNT(*) as cnt FROM organization_team_members WHERE team_id = ? AND user_id = ?',
        [subm.team_id, user.id]
      );
      if (inTeam[0]?.cnt === 0) {
        const isMgr = await canReviewSubmissions(user.id, docObj || subm, projObj);
        if (!isMgr) {
          return res.status(403).json({ error: 'You are not a member of the assigned team for this submission' });
        }
      }
    }

    let currentData: Record<string, any> = {};
    if (typeof subm.elements_data === 'string') {
      try {
        currentData = JSON.parse(subm.elements_data);
      } catch {
        currentData = {};
      }
    } else if (typeof subm.elements_data === 'object' && subm.elements_data !== null) {
      currentData = subm.elements_data;
    }

    const finalElementsData = elements_data !== undefined ? { ...currentData, ...elements_data } : currentData;
    const template = await fetchTemplateById(subm.template_id);
    const authorLabel = subm.submission_type === 'personal' ? (user.name || user.username) : (subm.team_name || 'Team');

    const compiledMd = compileDocumentMarkdown(
      subm.doc_title,
      subm.status,
      authorLabel,
      [],
      template,
      finalElementsData
    );

    await pool.query(
      `UPDATE document_submissions
       SET elements_data = ?, compiled_markdown = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(finalElementsData), compiledMd, submissionId]
    );

    // Keep corresponding document copy in sync
    if (subm.submission_type === 'team' && subm.team_id) {
      await pool.query(
        `UPDATE documents
         SET elements_data = ?, compiled_markdown = ?, updated_at = NOW()
         WHERE copied_from_id = ? AND assigned_team_id = ?`,
        [JSON.stringify(finalElementsData), compiledMd, subm.document_id, subm.team_id]
      );
    } else if (subm.submission_type === 'personal' && subm.user_id) {
      await pool.query(
        `UPDATE documents
         SET elements_data = ?, compiled_markdown = ?, updated_at = NOW()
         WHERE copied_from_id = ? AND created_by = ?`,
        [JSON.stringify(finalElementsData), compiledMd, subm.document_id, subm.user_id]
      );
    }

    const [updated] = await pool.query<any[]>(
      `SELECT ds.*, u.name as user_name, u.username, u.email as user_email, ot.name as team_name,
         (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
       FROM document_submissions ds
       LEFT JOIN users u ON ds.user_id = u.id
       LEFT JOIN organization_teams ot ON ds.team_id = ot.id
       WHERE ds.id = ?`,
      [submissionId]
    );

    res.json(formatSubmissionRow(updated[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update submission', detail: err.message });
  }
});

// POST /api/v1/documents/:id/submissions/:submissionId/submit - Mark submission as submitted
documentsRouter.post('/:id/submissions/:submissionId/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id: docId, submissionId } = req.params;

    const [existing] = await pool.query<any[]>(
      `SELECT * FROM document_submissions
       WHERE id = ? AND (document_id = ? OR document_id IN (SELECT copied_from_id FROM documents WHERE id = ?) OR document_id IN (SELECT id FROM documents WHERE copied_from_id = ?))`,
      [submissionId, docId, docId, docId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const subm = existing[0];

    // Fetch document and project metadata
    let docObj: any = null;
    let projObj: any = null;
    if (subm.document_id) {
      const [dRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [subm.document_id]);
      if (dRows && dRows.length > 0) docObj = dRows[0];
    }
    if (subm.project_id) {
      const [pRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [subm.project_id]);
      if (pRows && pRows.length > 0) projObj = pRows[0];
    }

    // Permission check
    if (subm.submission_type === 'personal') {
      if (subm.user_id !== user.id) {
        const isReviewer = await canReviewSubmissions(user.id, docObj || subm, projObj);
        if (!isReviewer) {
          return res.status(403).json({ error: 'Only the author can submit this personal submission' });
        }
      }
    } else {
      const [inTeam] = await pool.query<any[]>(
        'SELECT COUNT(*) as cnt FROM organization_team_members WHERE team_id = ? AND user_id = ?',
        [subm.team_id, user.id]
      );
      if (inTeam[0]?.cnt === 0) {
        const isReviewer = await canReviewSubmissions(user.id, docObj || subm, projObj);
        if (!isReviewer) {
          return res.status(403).json({ error: 'Only team members can submit on behalf of the team' });
        }
      }
    }

    // Optional atomic update of elements_data if provided in request body
    let finalElementsData: Record<string, any> | null = null;
    let compiledMd: string | null = null;
    if (req.body && req.body.elements_data !== undefined) {
      let currentData: Record<string, any> = {};
      if (typeof subm.elements_data === 'string') {
        try {
          currentData = JSON.parse(subm.elements_data);
        } catch {
          currentData = {};
        }
      } else if (typeof subm.elements_data === 'object' && subm.elements_data !== null) {
        currentData = subm.elements_data;
      }
      const elementsToUse: Record<string, any> = { ...currentData, ...req.body.elements_data };
      finalElementsData = elementsToUse;
      const template = await fetchTemplateById(subm.template_id || (docObj ? docObj.template_id : null));
      const authorLabel = subm.submission_type === 'personal' ? (user.name || user.username) : (subm.team_name || 'Team');
      const docTitle = subm.doc_title || (docObj ? docObj.title : 'Document');
      compiledMd = compileDocumentMarkdown(
        docTitle,
        'submitted',
        authorLabel,
        [],
        template,
        elementsToUse
      );
    }

    if (finalElementsData !== null) {
      await pool.query(
        `UPDATE document_submissions
         SET status = 'submitted', elements_data = ?, compiled_markdown = ?, submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(finalElementsData), compiledMd, submissionId]
      );
    } else {
      await pool.query(
        `UPDATE document_submissions
         SET status = 'submitted', submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW()
         WHERE id = ?`,
        [submissionId]
      );
    }

    // Synchronize status to document copy in documents table
    if (subm.submission_type === 'personal') {
      if (finalElementsData !== null) {
        await pool.query(
          `UPDATE documents SET status = 'in_review', elements_data = ?, compiled_markdown = ?, updated_at = NOW()
           WHERE (copied_from_id = ? AND created_by = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
          [JSON.stringify(finalElementsData), compiledMd, subm.document_id, subm.user_id, docId]
        );
      } else {
        await pool.query(
          `UPDATE documents SET status = 'in_review', updated_at = NOW()
           WHERE (copied_from_id = ? AND created_by = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
          [subm.document_id, subm.user_id, docId]
        );
      }
    } else {
      if (finalElementsData !== null) {
        await pool.query(
          `UPDATE documents SET status = 'in_review', elements_data = ?, compiled_markdown = ?, updated_at = NOW()
           WHERE (copied_from_id = ? AND assigned_team_id = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
          [JSON.stringify(finalElementsData), compiledMd, subm.document_id, subm.team_id, docId]
        );
      } else {
        await pool.query(
          `UPDATE documents SET status = 'in_review', updated_at = NOW()
           WHERE (copied_from_id = ? AND assigned_team_id = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
          [subm.document_id, subm.team_id, docId]
        );
      }
    }

    const [updated] = await pool.query<any[]>(
      `SELECT ds.*, u.name as user_name, u.username, u.email as user_email, ot.name as team_name,
         (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
       FROM document_submissions ds
       LEFT JOIN users u ON ds.user_id = u.id
       LEFT JOIN organization_teams ot ON ds.team_id = ot.id
       WHERE ds.id = ?`,
      [submissionId]
    );

    res.json({
      message: 'Document submitted successfully!',
      submission: formatSubmissionRow(updated[0]),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit document', detail: err.message });
  }
});

// POST /api/v1/documents/:id/submissions/:submissionId/unsubmit - Revert submission to draft
documentsRouter.post('/:id/submissions/:submissionId/unsubmit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id: docId, submissionId } = req.params;

    const [existing] = await pool.query<any[]>(
      `SELECT * FROM document_submissions
       WHERE id = ? AND (document_id = ? OR document_id IN (SELECT copied_from_id FROM documents WHERE id = ?) OR document_id IN (SELECT id FROM documents WHERE copied_from_id = ?))`,
      [submissionId, docId, docId, docId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const subm = existing[0];

    // Permission check
    if (subm.submission_type === 'personal') {
      if (subm.user_id !== user.id) {
        let docObj: any = null;
        let projObj: any = null;
        if (subm.document_id) {
          const [dRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [subm.document_id]);
          if (dRows && dRows.length > 0) docObj = dRows[0];
        }
        if (subm.project_id) {
          const [pRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [subm.project_id]);
          if (pRows && pRows.length > 0) projObj = pRows[0];
        }
        const isReviewer = await canReviewSubmissions(user.id, docObj || subm, projObj);
        if (!isReviewer) {
          return res.status(403).json({ error: 'Only the author can unsubmit this personal submission' });
        }
      }
    } else {
      const [inTeam] = await pool.query<any[]>(
        'SELECT COUNT(*) as cnt FROM organization_team_members WHERE team_id = ? AND user_id = ?',
        [subm.team_id, user.id]
      );
      if (inTeam[0]?.cnt === 0) {
        let docObj: any = null;
        let projObj: any = null;
        if (subm.document_id) {
          const [dRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [subm.document_id]);
          if (dRows && dRows.length > 0) docObj = dRows[0];
        }
        if (subm.project_id) {
          const [pRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [subm.project_id]);
          if (pRows && pRows.length > 0) projObj = pRows[0];
        }
        const isReviewer = await canReviewSubmissions(user.id, docObj || subm, projObj);
        if (!isReviewer) {
          return res.status(403).json({ error: 'Only team members can unsubmit this team document' });
        }
      }
    }

    await pool.query(
      `UPDATE document_submissions
       SET status = 'draft', updated_at = NOW()
       WHERE id = ?`,
      [submissionId]
    );

    // Also revert document copy in documents table (only copy documents)
    if (subm.submission_type === 'personal') {
      await pool.query(
        `UPDATE documents SET status = 'draft', updated_at = NOW()
         WHERE (copied_from_id = ? AND created_by = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
        [subm.document_id, subm.user_id, docId]
      );
    } else {
      await pool.query(
        `UPDATE documents SET status = 'draft', updated_at = NOW()
         WHERE (copied_from_id = ? AND assigned_team_id = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
        [subm.document_id, subm.team_id, docId]
      );
    }

    const [updated] = await pool.query<any[]>(
      `SELECT ds.*, u.name as user_name, u.username, u.email as user_email, ot.name as team_name,
         (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
       FROM document_submissions ds
       LEFT JOIN users u ON ds.user_id = u.id
       LEFT JOIN organization_teams ot ON ds.team_id = ot.id
       WHERE ds.id = ?`,
      [submissionId]
    );

    res.json({
      message: 'Submission reverted to draft',
      submission: formatSubmissionRow(updated[0]),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unsubmit document', detail: err.message });
  }
});

// PUT /api/v1/documents/:id/submissions/:submissionId/status - Reviewer status update
documentsRouter.put('/:id/submissions/:submissionId/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id: docId, submissionId } = req.params;
    const { status } = req.body;

    if (!status || !['draft', 'submitted', 'reviewed'].includes(status)) {
      return res.status(400).json({ error: 'status must be draft, submitted, or reviewed' });
    }

    const [docRows] = await pool.query<any[]>('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!docRows || docRows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docRows[0];

    let project: any = null;
    if (doc.project_id) {
      const [projRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [doc.project_id]);
      if (projRows && projRows.length > 0) project = projRows[0];
    }

    const canReview = await canReviewSubmissions(user.id, doc, project);
    if (!canReview) {
      return res.status(403).json({ error: 'Only project creators or organization managers can review submissions' });
    }

    await pool.query(
      'UPDATE document_submissions SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, submissionId]
    );

    const [submExisting] = await pool.query<any[]>('SELECT * FROM document_submissions WHERE id = ?', [submissionId]);
    if (submExisting && submExisting.length > 0) {
      const subm = submExisting[0];
      const targetDocStatus = status === 'reviewed' ? 'approved' : (status === 'submitted' ? 'in_review' : 'draft');
      if (subm.submission_type === 'personal') {
        await pool.query(
          `UPDATE documents SET status = ?, updated_at = NOW()
           WHERE (copied_from_id = ? AND created_by = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
          [targetDocStatus, subm.document_id, subm.user_id, docId]
        );
      } else {
        await pool.query(
          `UPDATE documents SET status = ?, updated_at = NOW()
           WHERE (copied_from_id = ? AND assigned_team_id = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
          [targetDocStatus, subm.document_id, subm.team_id, docId]
        );
      }
    }

    const [updated] = await pool.query<any[]>(
      `SELECT ds.*, u.name as user_name, u.username, u.email as user_email, ot.name as team_name,
         (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
       FROM document_submissions ds
       LEFT JOIN users u ON ds.user_id = u.id
       LEFT JOIN organization_teams ot ON ds.team_id = ot.id
       WHERE ds.id = ?`,
      [submissionId]
    );

    res.json(formatSubmissionRow(updated[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update submission status', detail: err.message });
  }
});

// GET /api/v1/documents/:id/submissions/:submissionId/comments - List comments for submission
documentsRouter.get('/:id/submissions/:submissionId/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const [comments] = await pool.query<any[]>(
      `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.submission_id = ?
       ORDER BY sc.created_at ASC`,
      [submissionId]
    );

    res.json(
      comments.map((c) => ({
        id: c.id,
        submission_id: c.submission_id,
        user_id: c.user_id,
        user_name: c.user_name || c.username,
        user_email: c.user_email,
        content: c.content,
        created_at: new Date(c.created_at).toISOString(),
        updated_at: new Date(c.updated_at).toISOString(),
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve comments', detail: err.message });
  }
});

// POST /api/v1/documents/:id/submissions/:submissionId/comments - Add comment (creator review & feedback)
documentsRouter.post('/:id/submissions/:submissionId/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { submissionId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const [submRows] = await pool.query<any[]>('SELECT * FROM document_submissions WHERE id = ?', [submissionId]);
    if (!submRows || submRows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const cmtId = `subm_cmt-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO submission_comments (id, submission_id, user_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [cmtId, submissionId, user.id, content.trim()]
    );

    const [newCmt] = await pool.query<any[]>(
      `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.id = ?`,
      [cmtId]
    );

    res.status(201).json({
      id: newCmt[0].id,
      submission_id: newCmt[0].submission_id,
      user_id: newCmt[0].user_id,
      user_name: newCmt[0].user_name || newCmt[0].username,
      user_email: newCmt[0].user_email,
      content: newCmt[0].content,
      created_at: new Date(newCmt[0].created_at).toISOString(),
      updated_at: new Date(newCmt[0].updated_at).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to post comment', detail: err.message });
  }
});
