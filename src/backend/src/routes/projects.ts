import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { AuthenticatedRequest, isTeamManager, isTeamMember, requireAuth } from '../auth';
import { Project } from '../models';

export const projectsRouter = Router();

function formatProjectRow(row: any): Project {
  return {
    id: row.id,
    team_id: row.team_id,
    name: row.name,
    description: row.description || '',
    created_by: row.created_by,
    documents_count: Number(row.documents_count || 0),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/projects - List projects (optional ?team_id=...)
projectsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { team_id } = req.query;

    let sql = `
      SELECT p.*,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
      FROM projects p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE tm.user_id = ?
    `;
    const params: any[] = [userId];

    if (team_id && typeof team_id === 'string') {
      sql += ' AND p.team_id = ?';
      params.push(team_id);
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
       JOIN team_members tm ON p.team_id = tm.team_id
       WHERE p.id = ? AND tm.user_id = ?`,
      [projectId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or you do not have access' });
    }

    res.json(formatProjectRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project', detail: err.message });
  }
});

// POST /api/v1/projects - Create project in a team
projectsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { team_id, name, description } = req.body;

    if (!team_id || typeof team_id !== 'string') {
      return res.status(400).json({ error: 'Valid team_id is required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Verify user is a member of the team
    const isMember = await isTeamMember(userId, team_id);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a member of the team to create a project' });
    }

    const projectId = `proj-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO projects (id, team_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [projectId, team_id, name.trim(), description || '', userId]
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
    const isMember = await isTeamMember(userId, current.team_id);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of the team for this project' });
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
    const isManager = await isTeamManager(userId, current.team_id);
    if (!isManager && current.created_by !== userId) {
      return res.status(403).json({ error: 'Only team managers or the project creator can delete projects' });
    }

    // Unlink documents or delete
    await pool.query('DELETE FROM documents WHERE project_id = ?', [projectId]);
    await pool.query('DELETE FROM projects WHERE id = ?', [projectId]);

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete project', detail: err.message });
  }
});
