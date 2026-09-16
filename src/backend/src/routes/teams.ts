import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { AuthenticatedRequest, isTeamManager, isTeamMember, requireAuth } from '../auth';
import { Team, TeamMember, Project } from '../models';

export const teamsRouter = Router();

function formatTeamRow(row: any): Team {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    join_code: row.join_code,
    created_by: row.created_by,
    user_role: row.user_role,
    members_count: Number(row.members_count || 0),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/teams - List user's teams
teamsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [rows] = await pool.query<any[]>(
      `SELECT t.*, tm.role as user_role,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members_count
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = ?
       ORDER BY t.created_at ASC`,
      [userId]
    );

    res.json(rows.map(formatTeamRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve teams', detail: err.message });
  }
});

// POST /api/v1/teams - Create a new team (Only Organizer role)
teamsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.user_type !== 'organizer') {
      return res.status(403).json({
        error: 'Permission denied: Only users with the Organizer role can create teams. You can change your user type in your Account settings.',
      });
    }

    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const teamId = `team-${crypto.randomBytes(4).toString('hex')}`;
    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const joinCode = `TEAM-${randomCode}`;

    await pool.query(
      `INSERT INTO teams (id, name, description, join_code, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [teamId, name.trim(), description || '', joinCode, user.id]
    );

    // Add creator as manager
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at)
       VALUES (?, ?, 'manager', NOW())`,
      [teamId, user.id]
    );

    // Create a starter default project for this team
    const projId = `proj-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO projects (id, team_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [projId, teamId, 'General Documentation', 'Starter project for team documents and specifications.', user.id]
    );

    const [rows] = await pool.query<any[]>(
      `SELECT t.*, 'manager' as user_role, 1 as members_count
       FROM teams t WHERE t.id = ?`,
      [teamId]
    );

    res.status(201).json(formatTeamRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create team', detail: err.message });
  }
});

// POST /api/v1/teams/join - Join team via join_code
teamsRouter.post('/join', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { join_code } = req.body;

    if (!join_code || typeof join_code !== 'string' || !join_code.trim()) {
      return res.status(400).json({ error: 'Team join code / token is required' });
    }

    const cleanCode = join_code.trim().toUpperCase();
    const [teamRows] = await pool.query<any[]>('SELECT * FROM teams WHERE UPPER(join_code) = ?', [cleanCode]);
    if (!teamRows || teamRows.length === 0) {
      return res.status(404).json({ error: 'Invalid join code. No team found matching this code.' });
    }

    const team = teamRows[0];

    // Check if already a member
    const [memberRows] = await pool.query<any[]>(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?',
      [team.id, userId]
    );

    if (memberRows && memberRows.length > 0) {
      return res.json({
        message: 'You are already a member of this team',
        team: formatTeamRow({ ...team, user_role: memberRows[0].role }),
      });
    }

    // Add user as regular member
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at)
       VALUES (?, ?, 'member', NOW())`,
      [team.id, userId]
    );

    const [updatedTeamRows] = await pool.query<any[]>(
      `SELECT t.*, 'member' as user_role,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members_count
       FROM teams t WHERE t.id = ?`,
      [team.id]
    );

    res.json({
      message: `Successfully joined team "${team.name}"!`,
      team: formatTeamRow(updatedTeamRows[0]),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to join team', detail: err.message });
  }
});

// GET /api/v1/teams/:id - Get team details with members and projects
teamsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const teamId = req.params.id;

    // Verify user is a member of the team
    const isMember = await isTeamMember(userId, teamId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const [teamRows] = await pool.query<any[]>('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!teamRows || teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamRows[0];

    // Fetch members
    const [memberRows] = await pool.query<any[]>(
      `SELECT tm.team_id, tm.user_id, tm.role, tm.joined_at,
              u.username, u.name, u.email, u.user_type
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = ?
       ORDER BY tm.role = 'manager' DESC, tm.joined_at ASC`,
      [teamId]
    );

    const members: TeamMember[] = memberRows.map((m) => ({
      team_id: m.team_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: new Date(m.joined_at).toISOString(),
      username: m.username,
      name: m.name,
      email: m.email,
      user_type: m.user_type,
    }));

    // Fetch projects
    const [projectRows] = await pool.query<any[]>(
      `SELECT p.*,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       WHERE p.team_id = ?
       ORDER BY p.created_at ASC`,
      [teamId]
    );

    const projects: Project[] = projectRows.map((p) => ({
      id: p.id,
      team_id: p.team_id,
      name: p.name,
      description: p.description || '',
      created_by: p.created_by,
      documents_count: Number(p.documents_count || 0),
      created_at: new Date(p.created_at).toISOString(),
      updated_at: new Date(p.updated_at).toISOString(),
    }));

    const userMembership = members.find((m) => m.user_id === userId);

    res.json({
      team: {
        ...formatTeamRow({ ...team, user_role: userMembership?.role || 'member', members_count: members.length }),
        members,
        projects,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve team details', detail: err.message });
  }
});

// PUT /api/v1/teams/:id - Update team name/desc (only manager)
teamsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const teamId = req.params.id;

    const isManager = await isTeamManager(userId, teamId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only team managers can update team settings' });
    }

    const { name, description } = req.body;
    const [teamRows] = await pool.query<any[]>('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!teamRows || teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const current = teamRows[0];
    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;

    await pool.query(
      `UPDATE teams SET name = ?, description = ?, updated_at = NOW() WHERE id = ?`,
      [newName, newDesc, teamId]
    );

    const [updatedRows] = await pool.query<any[]>('SELECT * FROM teams WHERE id = ?', [teamId]);
    res.json(formatTeamRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update team', detail: err.message });
  }
});

// POST /api/v1/teams/:id/regenerate-token - Regenerate join token (only manager)
teamsRouter.post('/:id/regenerate-token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const teamId = req.params.id;

    const isManager = await isTeamManager(userId, teamId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only team managers can regenerate the team join token' });
    }

    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const newJoinCode = `TEAM-${randomCode}`;

    await pool.query('UPDATE teams SET join_code = ?, updated_at = NOW() WHERE id = ?', [newJoinCode, teamId]);

    res.json({
      message: 'Join token regenerated successfully',
      join_code: newJoinCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to regenerate join token', detail: err.message });
  }
});

// POST /api/v1/teams/:id/members - Add member by userId or username (only manager)
teamsRouter.post('/:id/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const teamId = req.params.id;

    const isManager = await isTeamManager(currentUserId, teamId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only team managers can add new members' });
    }

    const { userId, usernameOrEmail, role } = req.body;
    let targetUserId = userId;

    if (!targetUserId && usernameOrEmail) {
      const q = String(usernameOrEmail).trim().toLowerCase();
      const [uRows] = await pool.query<any[]>(
        'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
        [q, q]
      );
      if (uRows && uRows.length > 0) {
        targetUserId = uRows[0].id;
      } else {
        return res.status(404).json({ error: `User "${usernameOrEmail}" not found` });
      }
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user is required' });
    }

    const memberRole = role === 'manager' ? 'manager' : 'member';

    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [teamId, targetUserId, memberRole]
    );

    res.status(201).json({ message: 'Member added to team successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add member', detail: err.message });
  }
});

// PUT /api/v1/teams/:id/members/:userId - Update member role (only manager)
teamsRouter.put('/:id/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const teamId = req.params.id;
    const targetUserId = req.params.targetUserId;

    const isManager = await isTeamManager(currentUserId, teamId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only team managers can change member roles' });
    }

    const { role } = req.body;
    if (role !== 'manager' && role !== 'member') {
      return res.status(400).json({ error: "Role must be 'manager' or 'member'" });
    }

    await pool.query(
      'UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?',
      [role, teamId, targetUserId]
    );

    res.json({ message: `Member role updated to ${role}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update member role', detail: err.message });
  }
});

// DELETE /api/v1/teams/:id/members/:userId - Remove member from team
teamsRouter.delete('/:id/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const teamId = req.params.id;
    const targetUserId = req.params.targetUserId;

    // Allow user to leave team OR manager to remove member
    const isManager = await isTeamManager(currentUserId, teamId);
    if (currentUserId !== targetUserId && !isManager) {
      return res.status(403).json({ error: 'Only team managers can remove other members' });
    }

    // Prevent removing creator if they are the only manager
    const [teamRows] = await pool.query<any[]>('SELECT created_by FROM teams WHERE id = ?', [teamId]);
    if (teamRows && teamRows.length > 0 && teamRows[0].created_by === targetUserId && currentUserId !== targetUserId) {
      return res.status(400).json({ error: 'Cannot remove the original creator of the team' });
    }

    await pool.query('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, targetUserId]);

    res.json({ message: 'Member removed from team' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove member', detail: err.message });
  }
});
