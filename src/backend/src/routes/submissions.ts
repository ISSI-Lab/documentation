import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { DocumentSubmission, SubmissionComment, SubmissionStatus, SubmissionType } from '../models';
import { AuthenticatedRequest, isOrganizationManager, requireAuth } from '../auth';

export const submissionsRouter = Router();

function formatSubmissionWithDetails(row: any, comments: SubmissionComment[] = []): DocumentSubmission {
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
    project_id: row.project_id || '',
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
    document_title: row.document_title || undefined,
    document_type: row.document_type || undefined,
    project_name: row.project_name || undefined,
    template_title: row.template_title || undefined,
    document_creator_id: row.document_creator_id || undefined,
  };
}

// GET /api/v1/submissions - List all submissions accessible to the current user
submissionsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      role, // 'creator' | 'participant' | 'all'
      project_id,
      document_id,
      status, // 'submitted' | 'reviewed' | 'draft' | 'all'
      organization_id,
      search,
    } = req.query;

    let query = `
      SELECT ds.*,
        COALESCE((SELECT title FROM documents WHERE id = d.copied_from_id), d.title) as document_title,
        d.document_type as document_type,
        d.organization_id as organization_id,
        COALESCE((SELECT created_by FROM documents WHERE id = d.copied_from_id), d.created_by) as document_creator_id,
        (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id,
        d.template_id,
        d.template_title,
        p.name as project_name,
        u.name as user_name,
        u.username as user_username,
        u.email as user_email,
        ot.name as team_name,
        (SELECT COUNT(*) FROM submission_comments WHERE submission_id = ds.id) as comments_count
      FROM document_submissions ds
      JOIN documents d ON ds.document_id = d.id
      LEFT JOIN projects p ON ds.project_id = p.id
      LEFT JOIN users u ON ds.user_id = u.id
      LEFT JOIN organization_teams ot ON ds.team_id = ot.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Access control based on user role
    if (role === 'creator') {
      // Creator review view: user is document creator, project creator, or organization manager
      conditions.push(
        `(
          d.created_by = ?
          OR (d.copied_from_id IS NOT NULL AND EXISTS (SELECT 1 FROM documents m WHERE m.id = d.copied_from_id AND m.created_by = ?))
          OR (p.created_by IS NOT NULL AND p.created_by = ?)
          OR (d.organization_id IS NOT NULL AND d.organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = ? AND role IN ('owner', 'manager')
          ))
        )`
      );
      params.push(userId, userId, userId, userId);
    } else if (role === 'participant') {
      // Participant view: only user's own submissions or user's team submissions
      conditions.push(
        `(
          ds.user_id = ?
          OR (ds.team_id IS NOT NULL AND ds.team_id IN (
            SELECT team_id FROM organization_team_members WHERE user_id = ?
          ))
        )`
      );
      params.push(userId, userId);
    } else {
      // General view: user is either reviewer OR submitter
      conditions.push(
        `(
          d.created_by = ?
          OR (d.copied_from_id IS NOT NULL AND EXISTS (SELECT 1 FROM documents m WHERE m.id = d.copied_from_id AND m.created_by = ?))
          OR (p.created_by IS NOT NULL AND p.created_by = ?)
          OR (d.organization_id IS NOT NULL AND d.organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = ? AND role IN ('owner', 'manager')
          ))
          OR ds.user_id = ?
          OR (ds.team_id IS NOT NULL AND ds.team_id IN (
            SELECT team_id FROM organization_team_members WHERE user_id = ?
          ))
        )`
      );
      params.push(userId, userId, userId, userId, userId, userId);
    }

    if (project_id && typeof project_id === 'string') {
      conditions.push('(ds.project_id = ? OR d.project_id = ?)');
      params.push(project_id, project_id);
    }

    if (document_id && typeof document_id === 'string') {
      conditions.push(
        '(ds.document_id = ? OR ds.document_id IN (SELECT id FROM documents WHERE copied_from_id = ?) OR ds.document_id IN (SELECT copied_from_id FROM documents WHERE id = ?))'
      );
      params.push(document_id, document_id, document_id);
    }

    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push('ds.status = ?');
      params.push(status);
    }

    if (organization_id && typeof organization_id === 'string') {
      conditions.push('d.organization_id = ?');
      params.push(organization_id);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        '(LOWER(d.title) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(ot.name) LIKE ?)'
      );
      params.push(q, q, q, q);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY ds.updated_at DESC';

    const [rows] = await pool.query<any[]>(query, params);
    const results = rows.map((r) => formatSubmissionWithDetails(r));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve submissions', detail: err.message });
  }
});

// GET /api/v1/submissions/:id - Get a single submission by its ID with full comments thread
submissionsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const submissionId = req.params.id;
    const [rows] = await pool.query<any[]>(
      `SELECT ds.*,
        d.title as document_title,
        d.document_type as document_type,
        d.organization_id as organization_id,
        d.created_by as document_creator_id,
        d.template_id,
        d.template_title,
        p.name as project_name,
        u.name as user_name,
        u.username as user_username,
        u.email as user_email,
        ot.name as team_name
      FROM document_submissions ds
      JOIN documents d ON ds.document_id = d.id
      LEFT JOIN projects p ON ds.project_id = p.id
      LEFT JOIN users u ON ds.user_id = u.id
      LEFT JOIN organization_teams ot ON ds.team_id = ot.id
      WHERE ds.id = ?`,
      [submissionId]
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

    res.json(formatSubmissionWithDetails(rows[0], comments));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve submission', detail: err.message });
  }
});

// PUT /api/v1/submissions/:id/status - Update submission review status
submissionsRouter.put('/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const submissionId = req.params.id;
    const { status } = req.body;

    if (!['draft', 'submitted', 'reviewed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be draft, submitted, or reviewed.' });
    }

    const [existing] = await pool.query<any[]>(
      `SELECT ds.*,
        d.created_by as document_creator_id,
        (SELECT created_by FROM documents WHERE id = d.copied_from_id) as master_creator_id,
        d.organization_id,
        p.created_by as project_creator_id
       FROM document_submissions ds
       JOIN documents d ON ds.document_id = d.id
       LEFT JOIN projects p ON ds.project_id = p.id
       WHERE ds.id = ?`,
      [submissionId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const subm = existing[0];
    const isDocCreator = subm.document_creator_id === userId || subm.master_creator_id === userId;
    const isProjCreator = subm.project_creator_id === userId;
    const isOrgMgr = subm.organization_id ? await isOrganizationManager(userId, subm.organization_id) : false;

    if (!isDocCreator && !isProjCreator && !isOrgMgr) {
      return res.status(403).json({ error: 'Only the creator or manager can update review status' });
    }

    await pool.query(
      'UPDATE document_submissions SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, submissionId]
    );

    // Synchronize status back to corresponding document instances in documents table (preserve master doc)
    if (subm.submission_type === 'personal') {
      await pool.query(
        `UPDATE documents SET status = ?, updated_at = NOW()
         WHERE (copied_from_id = ? AND created_by = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
        [status === 'reviewed' ? 'approved' : status, subm.document_id, subm.user_id, subm.document_id]
      );
    } else {
      await pool.query(
        `UPDATE documents SET status = ?, updated_at = NOW()
         WHERE (copied_from_id = ? AND assigned_team_id = ?) OR (id = ? AND copied_from_id IS NOT NULL)`,
        [status === 'reviewed' ? 'approved' : status, subm.document_id, subm.team_id, subm.document_id]
      );
    }

    const [updated] = await pool.query<any[]>(
      `SELECT ds.*,
        d.title as document_title,
        d.document_type as document_type,
        d.organization_id as organization_id,
        d.created_by as document_creator_id,
        d.template_id,
        d.template_title,
        p.name as project_name,
        u.name as user_name,
        u.username as user_username,
        u.email as user_email,
        ot.name as team_name
       FROM document_submissions ds
       JOIN documents d ON ds.document_id = d.id
       LEFT JOIN projects p ON ds.project_id = p.id
       LEFT JOIN users u ON ds.user_id = u.id
       LEFT JOIN organization_teams ot ON ds.team_id = ot.id
       WHERE ds.id = ?`,
      [submissionId]
    );

    const [comments] = await pool.query<any[]>(
      `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.submission_id = ?
       ORDER BY sc.created_at ASC`,
      [submissionId]
    );

    res.json(formatSubmissionWithDetails(updated[0], comments));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update submission status', detail: err.message });
  }
});

// GET /api/v1/submissions/:id/comments - Get comments for submission
submissionsRouter.get('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [comments] = await pool.query<any[]>(
      `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.submission_id = ?
       ORDER BY sc.created_at ASC`,
      [req.params.id]
    );
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve comments', detail: err.message });
  }
});

// POST /api/v1/submissions/:id/comments - Add review comment to submission
submissionsRouter.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const submissionId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const commentId = `cmnt-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO submission_comments (id, submission_id, user_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [commentId, submissionId, user.id, content.trim()]
    );

    const [created] = await pool.query<any[]>(
      `SELECT sc.*, u.name as user_name, u.username, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.id = ?`,
      [commentId]
    );

    res.status(201).json(created[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add comment', detail: err.message });
  }
});
