import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { AuthenticatedRequest, isOrganizationManager, isOrganizationMember, requireAuth } from '../auth';
import { Project } from '../models';

export const projectsRouter = Router();

function formatProjectRow(row: any): Project {
  const orgId = row.organization_id || row.team_id || null;
  return {
    id: row.id,
    organization_id: orgId,
    team_id: orgId, // compatibility
    name: row.name,
    description: row.description || '',
    created_by: row.created_by,
    documents_count: Number(row.documents_count || 0),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/projects - List projects (optional ?organization_id=... or ?team_id=...)
projectsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = (req.query.organization_id || req.query.team_id) as string | undefined;

    let sql = `
      SELECT p.*,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
      FROM projects p
      WHERE (p.organization_id IS NULL AND p.created_by = ?)
         OR (p.organization_id IS NOT NULL AND p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?))
    `;
    const params: any[] = [userId, userId];

    if (orgId === 'personal' || orgId === 'null') {
      sql += ' AND p.organization_id IS NULL AND p.created_by = ?';
      params.push(userId);
    } else if (orgId && typeof orgId === 'string') {
      sql += ' AND p.organization_id = ?';
      params.push(orgId);
    }

    sql += ' ORDER BY p.created_at ASC';

    const [rows] = await pool.query<any[]>(sql, params);
    res.json(rows.map(formatProjectRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve projects', detail: err.message });
  }
});

// GET /api/v1/projects/:id - Get project details
projectsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;

    const [rows] = await pool.query<any[]>(
      `SELECT p.*,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       WHERE p.id = ? AND (
         (p.organization_id IS NULL AND p.created_by = ?)
         OR (p.organization_id IS NOT NULL AND p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?))
       )`,
      [projectId, userId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or you do not have access' });
    }

    res.json(formatProjectRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project', detail: err.message });
  }
});

// POST /api/v1/projects - Create project in an organization or personal
projectsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { organization_id, team_id, name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const rawOrgId = organization_id || team_id;
    const resolvedOrgId = rawOrgId && typeof rawOrgId === 'string' && rawOrgId.trim() ? rawOrgId.trim() : null;

    if (resolvedOrgId) {
      // Verify user is a member of the organization
      const isMember = await isOrganizationMember(userId, resolvedOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You must be a member of the organization to create an organization project' });
      }
    }

    const projectId = `proj-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [projectId, resolvedOrgId, name.trim(), description || '', userId]
    );

    const [createdRows] = await pool.query<any[]>(
      `SELECT p.*, 0 as documents_count FROM projects p WHERE p.id = ?`,
      [projectId]
    );

    res.status(201).json(formatProjectRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create project', detail: err.message });
  }
});

// PUT /api/v1/projects/:id - Update project
projectsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { name, description } = req.body;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isMember = await isOrganizationMember(userId, currentOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the organization for this project' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this personal project' });
    }

    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;

    await pool.query(
      'UPDATE projects SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [newName, newDesc, projectId]
    );

    const [updatedRows] = await pool.query<any[]>(
      `SELECT p.*,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p WHERE p.id = ?`,
      [projectId]
    );

    res.json(formatProjectRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update project', detail: err.message });
  }
});

// DELETE /api/v1/projects/:id - Delete project
projectsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isManager = await isOrganizationManager(userId, currentOrgId);
      if (!isManager && current.created_by !== userId) {
        return res.status(403).json({ error: 'Only organization managers or the project creator can delete projects' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this personal project' });
    }

    // Unlink documents or delete
    await pool.query('DELETE FROM documents WHERE project_id = ?', [projectId]);
    await pool.query('DELETE FROM projects WHERE id = ?', [projectId]);

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete project', detail: err.message });
  }
});
