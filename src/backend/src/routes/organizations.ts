import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import {
  AuthenticatedRequest,
  isOrganizationCreator,
  isOrganizationManager,
  isOrganizationMember,
  requireAuth,
} from '../auth';
import {
  Organization,
  OrganizationMember,
  Project,
  OrganizationTeam,
  OrganizationTeamMember,
  TeamAssignmentSet,
  TeamAssignmentSetItem,
} from '../models';

export const organizationsRouter = Router();

function formatOrganizationRow(row: any, currentUserId?: string): Organization {
  const isCreator = currentUserId
    ? row.created_by === currentUserId
    : (row.is_creator ?? (row.created_by === row.user_id || row.user_role === 'owner'));

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    join_code: row.join_code,
    created_by: row.created_by,
    creator_name: row.creator_name || undefined,
    creator_username: row.creator_username || undefined,
    is_creator: isCreator,
    user_role: row.user_role,
    members_count: Number(row.members_count || 0),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/organizations - List user's organizations
organizationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [rows] = await pool.query<any[]>(
      `SELECT o.*, 
        CASE WHEN o.created_by = ? THEN 'owner' ELSE om.role END as user_role,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as members_count,
        cu.name as creator_name,
        cu.username as creator_username
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       LEFT JOIN users cu ON o.created_by = cu.id
       WHERE om.user_id = ?
       ORDER BY o.created_at ASC`,
      [userId, userId]
    );

    res.json(rows.map((r) => formatOrganizationRow(r, userId)));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve organizations', detail: err.message });
  }
});

// POST /api/v1/organizations - Create a new organization (Organizer accounts only; creator is Organization Owner)
organizationsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.user_type !== 'organizer') {
      return res.status(403).json({
        error: 'Only organizer accounts can create organizations. You can switch your role in Account settings.',
      });
    }

    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const orgId = `org-${crypto.randomBytes(4).toString('hex')}`;
    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const joinCode = `ORG-${randomCode}`;

    await pool.query(
      `INSERT INTO organizations (id, name, description, join_code, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [orgId, name.trim(), description || '', joinCode, user.id]
    );

    // Add creator as owner
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES (?, ?, 'owner', NOW())`,
      [orgId, user.id]
    );

    // Create a starter default project for this organization
    const projId = `proj-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [projId, orgId, 'General Documentation', 'Starter project for organization documents and specifications.', user.id]
    );

    const [rows] = await pool.query<any[]>(
      `SELECT o.*, 'owner' as user_role, 1 as members_count,
        cu.name as creator_name, cu.username as creator_username
       FROM organizations o
       LEFT JOIN users cu ON o.created_by = cu.id
       WHERE o.id = ?`,
      [orgId]
    );

    res.status(201).json(formatOrganizationRow(rows[0], user.id));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create organization', detail: err.message });
  }
});

// POST /api/v1/organizations/join - Join organization via join_code
organizationsRouter.post('/join', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { join_code } = req.body;

    if (!join_code || typeof join_code !== 'string' || !join_code.trim()) {
      return res.status(400).json({ error: 'Organization join code / token is required' });
    }

    const cleanCode = join_code.trim().toUpperCase();
    const [orgRows] = await pool.query<any[]>(
      `SELECT o.*, cu.name as creator_name, cu.username as creator_username
       FROM organizations o
       LEFT JOIN users cu ON o.created_by = cu.id
       WHERE UPPER(o.join_code) = ?`,
      [cleanCode]
    );
    if (!orgRows || orgRows.length === 0) {
      return res.status(404).json({ error: 'Invalid join code. No organization found matching this code.' });
    }

    const org = orgRows[0];

    // Check if already a member
    const [memberRows] = await pool.query<any[]>(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?',
      [org.id, userId]
    );

    if (memberRows && memberRows.length > 0) {
      return res.json({
        message: 'You are already a member of this organization',
        organization: formatOrganizationRow({ ...org, user_role: memberRows[0].role }, userId),
        team: formatOrganizationRow({ ...org, user_role: memberRows[0].role }, userId),
      });
    }

    // Add user as regular member
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES (?, ?, 'member', NOW())`,
      [org.id, userId]
    );

    const [updatedOrgRows] = await pool.query<any[]>(
      `SELECT o.*, 'member' as user_role,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as members_count,
        cu.name as creator_name, cu.username as creator_username
       FROM organizations o
       LEFT JOIN users cu ON o.created_by = cu.id
       WHERE o.id = ?`,
      [org.id]
    );

    res.json({
      message: `Successfully joined organization "${org.name}"!`,
      organization: formatOrganizationRow(updatedOrgRows[0], userId),
      team: formatOrganizationRow(updatedOrgRows[0], userId),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to join organization', detail: err.message });
  }
});

// GET /api/v1/organizations/:id - Get organization details with members and projects
organizationsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    // Verify user is a member of the organization
    const isMember = await isOrganizationMember(userId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const [orgRows] = await pool.query<any[]>(
      `SELECT o.*, cu.name as creator_name, cu.username as creator_username
       FROM organizations o
       LEFT JOIN users cu ON o.created_by = cu.id
       WHERE o.id = ?`,
      [orgId]
    );
    if (!orgRows || orgRows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const org = orgRows[0];

    // Fetch members
    const [memberRows] = await pool.query<any[]>(
      `SELECT om.organization_id, om.user_id,
              CASE WHEN o.created_by = om.user_id THEN 'owner' ELSE om.role END as role,
              om.joined_at, u.username, u.name, u.email, u.user_type
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = ?
       ORDER BY (o.created_by = om.user_id) DESC, (om.role = 'manager') DESC, om.joined_at ASC`,
      [orgId]
    );

    const members: OrganizationMember[] = memberRows.map((m) => ({
      organization_id: m.organization_id,
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
       WHERE p.organization_id = ?
       ORDER BY p.created_at ASC`,
      [orgId]
    );

    const projects: Project[] = projectRows.map((p) => ({
      id: p.id,
      organization_id: p.organization_id,
      team_id: p.organization_id,
      name: p.name,
      description: p.description || '',
      created_by: p.created_by,
      documents_count: Number(p.documents_count || 0),
      created_at: new Date(p.created_at).toISOString(),
      updated_at: new Date(p.updated_at).toISOString(),
    }));

    const userMembership = members.find((m) => m.user_id === userId);
    const isCreator = org.created_by === userId;
    const resolvedUserRole = isCreator ? 'owner' : (userMembership?.role || 'member');

    const formattedOrg = {
      ...formatOrganizationRow({ ...org, user_role: resolvedUserRole, members_count: members.length }, userId),
      is_creator: isCreator,
      creator_name: org.creator_name || undefined,
      creator_username: org.creator_username || undefined,
      members,
      projects,
    };

    res.json({
      organization: formattedOrg,
      team: formattedOrg, // compatibility
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve organization details', detail: err.message });
  }
});

// PUT /api/v1/organizations/:id - Update organization name/desc (only organization creator)
organizationsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can update organization settings' });
    }

    const { name, description } = req.body;
    const [orgRows] = await pool.query<any[]>('SELECT * FROM organizations WHERE id = ?', [orgId]);
    if (!orgRows || orgRows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const current = orgRows[0];
    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;

    await pool.query(
      `UPDATE organizations SET name = ?, description = ?, updated_at = NOW() WHERE id = ?`,
      [newName, newDesc, orgId]
    );

    const [updatedRows] = await pool.query<any[]>(
      `SELECT o.*, cu.name as creator_name, cu.username as creator_username
       FROM organizations o
       LEFT JOIN users cu ON o.created_by = cu.id
       WHERE o.id = ?`,
      [orgId]
    );
    res.json(formatOrganizationRow(updatedRows[0], userId));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update organization', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/regenerate-token - Regenerate join token (only organization creator)
organizationsRouter.post('/:id/regenerate-token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can regenerate the organization join token' });
    }

    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const newJoinCode = `ORG-${randomCode}`;

    await pool.query('UPDATE organizations SET join_code = ?, updated_at = NOW() WHERE id = ?', [newJoinCode, orgId]);

    res.json({
      message: 'Join token regenerated successfully',
      join_code: newJoinCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to regenerate join token', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/members - Add member by userId or username (only organization creator)
organizationsRouter.post('/:id/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const orgId = req.params.id;

    const isCreator = await isOrganizationCreator(currentUserId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can add new members' });
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
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [orgId, targetUserId, memberRole]
    );

    res.status(201).json({ message: 'Member added to organization successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add member', detail: err.message });
  }
});

// PUT /api/v1/organizations/:id/members/:targetUserId - Update member role (only organization creator)
organizationsRouter.put('/:id/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const orgId = req.params.id;
    const targetUserId = req.params.targetUserId;

    const isCreator = await isOrganizationCreator(currentUserId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can change member roles' });
    }

    const [orgRows] = await pool.query<any[]>('SELECT created_by FROM organizations WHERE id = ?', [orgId]);
    if (!orgRows || orgRows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (orgRows[0].created_by === targetUserId) {
      return res.status(400).json({ error: 'Cannot change the role of the original organization owner' });
    }

    const { role } = req.body;
    if (role !== 'manager' && role !== 'member') {
      return res.status(400).json({ error: "Role must be 'manager' or 'member'" });
    }

    await pool.query(
      'UPDATE organization_members SET role = ? WHERE organization_id = ? AND user_id = ?',
      [role, orgId, targetUserId]
    );

    res.json({ message: `Member role updated to ${role}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update member role', detail: err.message });
  }
});

// DELETE /api/v1/organizations/:id/members/:targetUserId - Remove member from organization
organizationsRouter.delete('/:id/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const orgId = req.params.id;
    const targetUserId = req.params.targetUserId;

    // Allow user to leave organization OR creator to remove member
    if (currentUserId !== targetUserId) {
      const isCreator = await isOrganizationCreator(currentUserId, orgId);
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the organization creator can remove other members' });
      }
    }

    // Prevent removing creator / owner
    const [orgRows] = await pool.query<any[]>('SELECT created_by FROM organizations WHERE id = ?', [orgId]);
    if (orgRows && orgRows.length > 0 && orgRows[0].created_by === targetUserId) {
      return res.status(400).json({ error: 'Cannot remove the original owner of the organization' });
    }

    await pool.query('DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?', [orgId, targetUserId]);

    res.json({ message: 'Member removed from organization' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove member', detail: err.message });
  }
});

// ==============================================================================
// Organization Teams Endpoints
// ==============================================================================

function formatTeamRow(row: any, members: OrganizationTeamMember[] = []): OrganizationTeam {
  return {
    id: row.id,
    organization_id: row.organization_id,
    set_id: row.set_id || null,
    set_name: row.set_name || undefined,
    name: row.name,
    description: row.description || '',
    created_by: row.created_by,
    members_count: Number(row.members_count !== undefined ? row.members_count : members.length),
    members,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

function formatSetRow(
  row: any,
  items: TeamAssignmentSetItem[] = [],
  teams: OrganizationTeam[] = []
): TeamAssignmentSet {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description || '',
    created_by: row.created_by,
    teams_count: Number(row.teams_count !== undefined ? row.teams_count : (teams.length || items.length)),
    associated_projects_count: Number(row.associated_projects_count || 0),
    teams,
    items,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/organizations/:id/teams - List all teams in organization
organizationsRouter.get('/:id/teams', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;
    const setIdQuery = req.query.set_id as string | undefined;

    const isMember = await isOrganizationMember(userId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    let sql = `
      SELECT t.*,
        tas.name as set_name,
        (SELECT COUNT(*) FROM organization_team_members WHERE team_id = t.id) as members_count
      FROM organization_teams t
      LEFT JOIN team_assignment_sets tas ON t.set_id = tas.id
      WHERE t.organization_id = ?
    `;
    const params: any[] = [orgId];

    if (setIdQuery) {
      sql += ' AND (t.set_id = ? OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id = ?))';
      params.push(setIdQuery, setIdQuery);
    }

    sql += ' ORDER BY t.created_at ASC';

    const [teamRows] = await pool.query<any[]>(sql, params);

    // Fetch members for each team
    const [allMemberRows] = await pool.query<any[]>(
      `SELECT otm.team_id, otm.user_id, otm.role, otm.joined_at, u.username, u.name, u.email, u.user_type
       FROM organization_team_members otm
       JOIN organization_teams ot ON otm.team_id = ot.id
       JOIN users u ON otm.user_id = u.id
       WHERE ot.organization_id = ?
       ORDER BY (otm.role = 'lead') DESC, otm.joined_at ASC`,
      [orgId]
    );

    const membersByTeam: Record<string, OrganizationTeamMember[]> = {};
    for (const m of allMemberRows) {
      if (!membersByTeam[m.team_id]) {
        membersByTeam[m.team_id] = [];
      }
      membersByTeam[m.team_id].push({
        team_id: m.team_id,
        user_id: m.user_id,
        role: m.role,
        joined_at: new Date(m.joined_at).toISOString(),
        username: m.username,
        name: m.name,
        email: m.email,
        user_type: m.user_type,
      });
    }

    const result = teamRows.map((t) => formatTeamRow(t, membersByTeam[t.id] || []));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve organization teams', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/teams - Create a team in organization (with optional set_id; only organization creator)
organizationsRouter.post('/:id/teams', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can form teams in this organization' });
    }

    const { name, description, set_id, initial_members } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Validate set_id if provided
    if (set_id) {
      const [setCheck] = await pool.query<any[]>(
        'SELECT id FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
        [set_id, orgId]
      );
      if (!setCheck || setCheck.length === 0) {
        return res.status(404).json({ error: 'Specified team assignment set not found in this organization' });
      }
    }

    const teamId = `team-${crypto.randomBytes(4).toString('hex')}`;

    await pool.query(
      `INSERT INTO organization_teams (id, organization_id, set_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [teamId, orgId, set_id || null, name.trim(), description || '', userId]
    );

    // If set_id is provided, also insert into team_assignment_set_items
    if (set_id) {
      await pool.query(
        `INSERT INTO team_assignment_set_items (set_id, team_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE team_id = VALUES(team_id)`,
        [set_id, teamId]
      );
    }

    // Add creator as team lead by default
    await pool.query(
      `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
       VALUES (?, ?, 'lead', NOW())`,
      [teamId, userId]
    );

    // Add any initial members requested
    if (Array.isArray(initial_members)) {
      for (const m of initial_members) {
        if (m.userId && m.userId !== userId) {
          const isTargetOrgMember = await isOrganizationMember(m.userId, orgId);
          if (isTargetOrgMember) {
            await pool.query(
              `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
               VALUES (?, ?, ?, NOW())
               ON DUPLICATE KEY UPDATE role = VALUES(role)`,
              [teamId, m.userId, m.role === 'lead' ? 'lead' : 'member']
            );
          }
        }
      }
    }

    const [createdRows] = await pool.query<any[]>(
      `SELECT t.*, tas.name as set_name,
        (SELECT COUNT(*) FROM organization_team_members WHERE team_id = t.id) as members_count
       FROM organization_teams t
       LEFT JOIN team_assignment_sets tas ON t.set_id = tas.id
       WHERE t.id = ?`,
      [teamId]
    );

    const [members] = await pool.query<any[]>(
      `SELECT otm.team_id, otm.user_id, otm.role, otm.joined_at, u.username, u.name, u.email, u.user_type
       FROM organization_team_members otm
       JOIN users u ON otm.user_id = u.id
       WHERE otm.team_id = ?`,
      [teamId]
    );

    res.status(201).json(formatTeamRow(createdRows[0], members.map((m) => ({
      team_id: m.team_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: new Date(m.joined_at).toISOString(),
      username: m.username,
      name: m.name,
      email: m.email,
      user_type: m.user_type,
    }))));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create team', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/team-assignment-sets/:setId/teams - Create a team WITHIN a team assignment set (only organization creator)
organizationsRouter.post('/:id/team-assignment-sets/:setId/teams', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, setId } = req.params;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can form teams in this organization' });
    }

    const [setCheck] = await pool.query<any[]>(
      'SELECT * FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
      [setId, orgId]
    );
    if (!setCheck || setCheck.length === 0) {
      return res.status(404).json({ error: 'Team assignment set not found in this organization' });
    }

    const { name, description, initial_members } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const teamId = `team-${crypto.randomBytes(4).toString('hex')}`;

    await pool.query(
      `INSERT INTO organization_teams (id, organization_id, set_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [teamId, orgId, setId, name.trim(), description || '', userId]
    );

    await pool.query(
      `INSERT INTO team_assignment_set_items (set_id, team_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE team_id = VALUES(team_id)`,
      [setId, teamId]
    );

    // Add creator as team lead by default
    await pool.query(
      `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
       VALUES (?, ?, 'lead', NOW())`,
      [teamId, userId]
    );

    // Add any initial members requested
    if (Array.isArray(initial_members)) {
      for (const m of initial_members) {
        if (m.userId && m.userId !== userId) {
          const isTargetOrgMember = await isOrganizationMember(m.userId, orgId);
          if (isTargetOrgMember) {
            await pool.query(
              `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
               VALUES (?, ?, ?, NOW())
               ON DUPLICATE KEY UPDATE role = VALUES(role)`,
              [teamId, m.userId, m.role === 'lead' ? 'lead' : 'member']
            );
          }
        }
      }
    }

    const [createdRows] = await pool.query<any[]>(
      `SELECT t.*, tas.name as set_name,
        (SELECT COUNT(*) FROM organization_team_members WHERE team_id = t.id) as members_count
       FROM organization_teams t
       LEFT JOIN team_assignment_sets tas ON t.set_id = tas.id
       WHERE t.id = ?`,
      [teamId]
    );

    const [members] = await pool.query<any[]>(
      `SELECT otm.team_id, otm.user_id, otm.role, otm.joined_at, u.username, u.name, u.email, u.user_type
       FROM organization_team_members otm
       JOIN users u ON otm.user_id = u.id
       WHERE otm.team_id = ?`,
      [teamId]
    );

    res.status(201).json(formatTeamRow(createdRows[0], members.map((m) => ({
      team_id: m.team_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: new Date(m.joined_at).toISOString(),
      username: m.username,
      name: m.name,
      email: m.email,
      user_type: m.user_type,
    }))));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create team in set', detail: err.message });
  }
});

// GET /api/v1/organizations/:id/teams/:teamId - Get single team details
organizationsRouter.get('/:id/teams/:teamId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, teamId } = req.params;

    const isMember = await isOrganizationMember(userId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT t.*, (SELECT COUNT(*) FROM organization_team_members WHERE team_id = t.id) as members_count
       FROM organization_teams t WHERE t.id = ? AND t.organization_id = ?`,
      [teamId, orgId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const [members] = await pool.query<any[]>(
      `SELECT otm.team_id, otm.user_id, otm.role, otm.joined_at, u.username, u.name, u.email, u.user_type
       FROM organization_team_members otm
       JOIN users u ON otm.user_id = u.id
       WHERE otm.team_id = ?`,
      [teamId]
    );

    res.json(formatTeamRow(rows[0], members.map((m) => ({
      team_id: m.team_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: new Date(m.joined_at).toISOString(),
      username: m.username,
      name: m.name,
      email: m.email,
      user_type: m.user_type,
    }))));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve team details', detail: err.message });
  }
});

// PUT /api/v1/organizations/:id/teams/:teamId - Update team name/description (only organization creator)
organizationsRouter.put('/:id/teams/:teamId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, teamId } = req.params;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can update teams in this organization' });
    }

    const [rows] = await pool.query<any[]>(
      'SELECT * FROM organization_teams WHERE id = ? AND organization_id = ?',
      [teamId, orgId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const { name, description } = req.body;
    const current = rows[0];
    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;

    await pool.query(
      'UPDATE organization_teams SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [newName, newDesc, teamId]
    );

    const [updated] = await pool.query<any[]>(
      `SELECT t.*, (SELECT COUNT(*) FROM organization_team_members WHERE team_id = t.id) as members_count
       FROM organization_teams t WHERE t.id = ?`,
      [teamId]
    );

    res.json(formatTeamRow(updated[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update team', detail: err.message });
  }
});

// DELETE /api/v1/organizations/:id/teams/:teamId - Delete team (only organization creator)
organizationsRouter.delete('/:id/teams/:teamId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, teamId } = req.params;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can delete teams in this organization' });
    }

    const [rows] = await pool.query<any[]>(
      'SELECT * FROM organization_teams WHERE id = ? AND organization_id = ?',
      [teamId, orgId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Cascade deletions
    await pool.query('DELETE FROM project_team_assignments WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM team_assignment_set_items WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM organization_team_members WHERE team_id = ?', [teamId]);
    await pool.query('DELETE FROM organization_teams WHERE id = ?', [teamId]);

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete team', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/teams/:teamId/members - Add member to team (only organization creator)
organizationsRouter.post('/:id/teams/:teamId/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const { id: orgId, teamId } = req.params;

    const isCreator = await isOrganizationCreator(currentUserId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can add members to teams in this organization' });
    }

    const { userId, role } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Target user must belong to this organization
    const isTargetOrgMember = await isOrganizationMember(userId, orgId);
    if (!isTargetOrgMember) {
      return res.status(400).json({ error: 'The user must be an organization member first' });
    }

    const memberRole = role === 'lead' ? 'lead' : 'member';

    await pool.query(
      `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [teamId, userId, memberRole]
    );

    res.status(201).json({ message: 'Member added to team successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add member to team', detail: err.message });
  }
});

// PUT /api/v1/organizations/:id/teams/:teamId/members/:targetUserId - Update member role in team (only organization creator)
organizationsRouter.put('/:id/teams/:teamId/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const { id: orgId, teamId, targetUserId } = req.params;

    const isCreator = await isOrganizationCreator(currentUserId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can update member roles in teams' });
    }

    const { role } = req.body;
    const newRole = role === 'lead' ? 'lead' : 'member';

    await pool.query(
      'UPDATE organization_team_members SET role = ? WHERE team_id = ? AND user_id = ?',
      [newRole, teamId, targetUserId]
    );

    res.json({ message: `Member role updated to ${newRole}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update member role in team', detail: err.message });
  }
});

// DELETE /api/v1/organizations/:id/teams/:teamId/members/:targetUserId - Remove member from team (only organization creator)
organizationsRouter.delete('/:id/teams/:teamId/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const { id: orgId, teamId, targetUserId } = req.params;

    const isCreator = await isOrganizationCreator(currentUserId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can remove members from teams' });
    }

    await pool.query(
      'DELETE FROM organization_team_members WHERE team_id = ? AND user_id = ?',
      [teamId, targetUserId]
    );

    res.json({ message: 'Member removed from team' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove member from team', detail: err.message });
  }
});

// ==============================================================================
// Team Assignment Sets Endpoints
// ==============================================================================

// Helper to load teams and members for a list of set IDs
async function fetchTeamsForSets(setIds: string[], orgId: string): Promise<{
  teamsBySet: Record<string, OrganizationTeam[]>;
  itemsBySet: Record<string, TeamAssignmentSetItem[]>;
}> {
  const teamsBySet: Record<string, OrganizationTeam[]> = {};
  const itemsBySet: Record<string, TeamAssignmentSetItem[]> = {};
  for (const sId of setIds) {
    teamsBySet[sId] = [];
    itemsBySet[sId] = [];
  }

  if (setIds.length === 0) {
    return { teamsBySet, itemsBySet };
  }

  // 1. Fetch items mapping
  const [itemRows] = await pool.query<any[]>(
    `SELECT tasi.*, ot.name as team_name, ot.description as team_description,
      (SELECT COUNT(*) FROM organization_team_members WHERE team_id = ot.id) as members_count
     FROM team_assignment_set_items tasi
     JOIN organization_teams ot ON tasi.team_id = ot.id
     WHERE tasi.set_id IN (?)`,
    [setIds]
  );

  for (const item of itemRows) {
    if (!itemsBySet[item.set_id]) itemsBySet[item.set_id] = [];
    itemsBySet[item.set_id].push({
      set_id: item.set_id,
      team_id: item.team_id,
      assigned_role: item.assigned_role,
      team_name: item.team_name,
      team_description: item.team_description,
      members_count: Number(item.members_count || 0),
    });
  }

  // 2. Fetch all teams belonging to these sets (by set_id OR item mapping)
  const [teamRows] = await pool.query<any[]>(
    `SELECT t.*, tas.name as set_name,
      (SELECT COUNT(*) FROM organization_team_members WHERE team_id = t.id) as members_count
     FROM organization_teams t
     LEFT JOIN team_assignment_sets tas ON t.set_id = tas.id
     WHERE t.organization_id = ?
       AND (t.set_id IN (?) OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id IN (?)))
     ORDER BY t.created_at ASC`,
    [orgId, setIds, setIds]
  );

  if (teamRows.length === 0) {
    return { teamsBySet, itemsBySet };
  }

  const teamIds = teamRows.map((t) => t.id);

  // 3. Fetch all members for these teams
  const [allMemberRows] = await pool.query<any[]>(
    `SELECT otm.team_id, otm.user_id, otm.role, otm.joined_at, u.username, u.name, u.email, u.user_type
     FROM organization_team_members otm
     JOIN users u ON otm.user_id = u.id
     WHERE otm.team_id IN (?)
     ORDER BY (otm.role = 'lead') DESC, otm.joined_at ASC`,
    [teamIds]
  );

  const membersByTeam: Record<string, OrganizationTeamMember[]> = {};
  for (const m of allMemberRows) {
    if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
    membersByTeam[m.team_id].push({
      team_id: m.team_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: new Date(m.joined_at).toISOString(),
      username: m.username,
      name: m.name,
      email: m.email,
      user_type: m.user_type,
    });
  }

  const teamById: Record<string, OrganizationTeam> = {};
  for (const t of teamRows) {
    teamById[t.id] = formatTeamRow(t, membersByTeam[t.id] || []);
  }

  // Group teams into sets
  for (const t of teamRows) {
    const formatted = teamById[t.id];
    // If team has explicit set_id
    if (t.set_id && teamsBySet[t.set_id]) {
      if (!teamsBySet[t.set_id].some((x) => x.id === t.id)) {
        teamsBySet[t.set_id].push(formatted);
      }
    }
  }

  // Also include teams from itemsBySet
  for (const [sId, items] of Object.entries(itemsBySet)) {
    if (!teamsBySet[sId]) teamsBySet[sId] = [];
    for (const it of items) {
      if (teamById[it.team_id] && !teamsBySet[sId].some((x) => x.id === it.team_id)) {
        teamsBySet[sId].push(teamById[it.team_id]);
      }
    }
  }

  return { teamsBySet, itemsBySet };
}

// GET /api/v1/organizations/:id/team-assignment-sets - List sets with nested teams
organizationsRouter.get('/:id/team-assignment-sets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isMember = await isOrganizationMember(userId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const [setRows] = await pool.query<any[]>(
      `SELECT s.*,
        (SELECT COUNT(DISTINCT t.id) FROM organization_teams t WHERE t.set_id = s.id OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id = s.id)) as teams_count,
        (SELECT COUNT(*) FROM projects WHERE team_assignment_set_id = s.id) as associated_projects_count
       FROM team_assignment_sets s
       WHERE s.organization_id = ?
       ORDER BY s.created_at ASC`,
      [orgId]
    );

    const setIds = setRows.map((s) => s.id);
    const { teamsBySet, itemsBySet } = await fetchTeamsForSets(setIds, orgId);

    const sets = setRows.map((s) => formatSetRow(s, itemsBySet[s.id] || [], teamsBySet[s.id] || []));
    res.json(sets);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve team assignment sets', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/team-assignment-sets - Create a reusable team assignment set (only organization creator)
organizationsRouter.post('/:id/team-assignment-sets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can create team formations in this organization' });
    }

    const { name, description, team_ids, items } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team assignment set name is required' });
    }

    const setId = `set-${crypto.randomBytes(4).toString('hex')}`;

    await pool.query(
      `INSERT INTO team_assignment_sets (id, organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [setId, orgId, name.trim(), description || '', userId]
    );

    // Items array can optionally be provided
    const itemsToInsert: { team_id: string; assigned_role?: string | null }[] = [];
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it && it.team_id) {
          itemsToInsert.push({ team_id: it.team_id, assigned_role: it.assigned_role || null });
        }
      }
    } else if (Array.isArray(team_ids)) {
      for (const tid of team_ids) {
        if (tid && typeof tid === 'string') {
          itemsToInsert.push({ team_id: tid, assigned_role: null });
        }
      }
    }

    for (const item of itemsToInsert) {
      await pool.query(
        `INSERT INTO team_assignment_set_items (set_id, team_id, assigned_role)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE assigned_role = VALUES(assigned_role)`,
        [setId, item.team_id, item.assigned_role || null]
      );
    }

    const [createdRows] = await pool.query<any[]>(
      `SELECT s.*, 0 as teams_count, 0 as associated_projects_count
       FROM team_assignment_sets s WHERE s.id = ?`,
      [setId]
    );

    const { teamsBySet, itemsBySet } = await fetchTeamsForSets([setId], orgId);
    res.status(201).json(formatSetRow(createdRows[0], itemsBySet[setId] || [], teamsBySet[setId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create team assignment set', detail: err.message });
  }
});

// GET /api/v1/organizations/:id/team-assignment-sets/:setId - Get single set
organizationsRouter.get('/:id/team-assignment-sets/:setId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, setId } = req.params;

    const isMember = await isOrganizationMember(userId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const [setRows] = await pool.query<any[]>(
      `SELECT s.*,
        (SELECT COUNT(DISTINCT t.id) FROM organization_teams t WHERE t.set_id = s.id OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id = s.id)) as teams_count,
        (SELECT COUNT(*) FROM projects WHERE team_assignment_set_id = s.id) as associated_projects_count
       FROM team_assignment_sets s
       WHERE s.id = ? AND s.organization_id = ?`,
      [setId, orgId]
    );

    if (!setRows || setRows.length === 0) {
      return res.status(404).json({ error: 'Team assignment set not found' });
    }

    const { teamsBySet, itemsBySet } = await fetchTeamsForSets([setId], orgId);
    res.json(formatSetRow(setRows[0], itemsBySet[setId] || [], teamsBySet[setId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve team assignment set', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/team-assignment-sets/:setId/clone - Clone a set with all its teams and members (only organization creator)
organizationsRouter.post('/:id/team-assignment-sets/:setId/clone', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, setId } = req.params;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can clone team formations in this organization' });
    }

    const [existingSets] = await pool.query<any[]>(
      'SELECT * FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
      [setId, orgId]
    );
    if (!existingSets || existingSets.length === 0) {
      return res.status(404).json({ error: 'Source team assignment set not found' });
    }

    const source = existingSets[0];
    const newName = req.body.name?.trim() || `${source.name} (Copy)`;
    const newDesc = req.body.description !== undefined ? req.body.description : source.description;
    const newSetId = `set-${crypto.randomBytes(4).toString('hex')}`;

    // 1. Create cloned set
    await pool.query(
      `INSERT INTO team_assignment_sets (id, organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [newSetId, orgId, newName, newDesc, userId]
    );

    // 2. Fetch original teams
    const { teamsBySet } = await fetchTeamsForSets([setId], orgId);
    const originalTeams = teamsBySet[setId] || [];

    // 3. Duplicate teams and members into the new set
    for (const origTeam of originalTeams) {
      const newTeamId = `team-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO organization_teams (id, organization_id, set_id, name, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [newTeamId, orgId, newSetId, origTeam.name, origTeam.description || '', userId]
      );

      await pool.query(
        `INSERT INTO team_assignment_set_items (set_id, team_id)
         VALUES (?, ?)`,
        [newSetId, newTeamId]
      );

      if (origTeam.members && origTeam.members.length > 0) {
        for (const m of origTeam.members) {
          await pool.query(
            `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
             VALUES (?, ?, ?, NOW())`,
            [newTeamId, m.user_id, m.role]
          );
        }
      }
    }

    const [newSetRows] = await pool.query<any[]>(
      `SELECT s.*, 0 as associated_projects_count
       FROM team_assignment_sets s WHERE s.id = ?`,
      [newSetId]
    );

    const { teamsBySet: newTeamsBySet, itemsBySet: newItemsBySet } = await fetchTeamsForSets([newSetId], orgId);
    res.status(201).json(formatSetRow(newSetRows[0], newItemsBySet[newSetId] || [], newTeamsBySet[newSetId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to clone team assignment set', detail: err.message });
  }
});

// PUT /api/v1/organizations/:id/team-assignment-sets/:setId - Update set (only organization creator)
organizationsRouter.put('/:id/team-assignment-sets/:setId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, setId } = req.params;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can update team formations in this organization' });
    }

    const [setRows] = await pool.query<any[]>(
      'SELECT * FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
      [setId, orgId]
    );
    if (!setRows || setRows.length === 0) {
      return res.status(404).json({ error: 'Team assignment set not found' });
    }

    const { name, description, team_ids, items } = req.body;
    const current = setRows[0];
    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;

    await pool.query(
      'UPDATE team_assignment_sets SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [newName, newDesc, setId]
    );

    // Update items if specified
    if (Array.isArray(items) || Array.isArray(team_ids)) {
      await pool.query('DELETE FROM team_assignment_set_items WHERE set_id = ?', [setId]);
      const itemsToInsert: { team_id: string; assigned_role?: string | null }[] = [];
      if (Array.isArray(items)) {
        for (const it of items) {
          if (it && it.team_id) itemsToInsert.push({ team_id: it.team_id, assigned_role: it.assigned_role || null });
        }
      } else if (Array.isArray(team_ids)) {
        for (const tid of team_ids) {
          if (tid && typeof tid === 'string') itemsToInsert.push({ team_id: tid, assigned_role: null });
        }
      }

      for (const item of itemsToInsert) {
        await pool.query(
          `INSERT INTO team_assignment_set_items (set_id, team_id, assigned_role)
           VALUES (?, ?, ?)`,
          [setId, item.team_id, item.assigned_role || null]
        );
      }
    }

    const [updatedRows] = await pool.query<any[]>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM projects WHERE team_assignment_set_id = s.id) as associated_projects_count
       FROM team_assignment_sets s WHERE s.id = ?`,
      [setId]
    );

    const { teamsBySet, itemsBySet } = await fetchTeamsForSets([setId], orgId);
    res.json(formatSetRow(updatedRows[0], itemsBySet[setId] || [], teamsBySet[setId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update team assignment set', detail: err.message });
  }
});

// DELETE /api/v1/organizations/:id/team-assignment-sets/:setId - Delete set and cascade (only organization creator)
organizationsRouter.delete('/:id/team-assignment-sets/:setId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: orgId, setId } = req.params;

    const isCreator = await isOrganizationCreator(userId, orgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can delete team formations in this organization' });
    }

    // Disassociate any projects pointing to this set
    await pool.query('UPDATE projects SET team_assignment_set_id = NULL WHERE team_assignment_set_id = ?', [setId]);

    // Delete teams created directly within this set
    const [teamsInSet] = await pool.query<any[]>(
      'SELECT id FROM organization_teams WHERE set_id = ?',
      [setId]
    );
    if (teamsInSet.length > 0) {
      const teamIds = teamsInSet.map((t) => t.id);
      await pool.query('DELETE FROM project_team_assignments WHERE team_id IN (?)', [teamIds]);
      await pool.query('DELETE FROM organization_team_members WHERE team_id IN (?)', [teamIds]);
      await pool.query('DELETE FROM organization_teams WHERE id IN (?)', [teamIds]);
    }

    await pool.query('DELETE FROM team_assignment_set_items WHERE set_id = ?', [setId]);
    await pool.query('DELETE FROM team_assignment_sets WHERE id = ?', [setId]);

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete team assignment set', detail: err.message });
  }
});

// Compatibility alias
export const teamsRouter = organizationsRouter;

