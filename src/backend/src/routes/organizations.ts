import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { AuthenticatedRequest, isOrganizationManager, isOrganizationMember, requireAuth } from '../auth';
import { Organization, OrganizationMember, Project } from '../models';

export const organizationsRouter = Router();

function formatOrganizationRow(row: any): Organization {
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

// GET /api/v1/organizations - List user's organizations
organizationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [rows] = await pool.query<any[]>(
      `SELECT o.*, 
        CASE WHEN o.created_by = ? THEN 'owner' ELSE om.role END as user_role,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as members_count
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = ?
       ORDER BY o.created_at ASC`,
      [userId, userId]
    );

    res.json(rows.map(formatOrganizationRow));
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
      `SELECT o.*, 'owner' as user_role, 1 as members_count
       FROM organizations o WHERE o.id = ?`,
      [orgId]
    );

    res.status(201).json(formatOrganizationRow(rows[0]));
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
    const [orgRows] = await pool.query<any[]>('SELECT * FROM organizations WHERE UPPER(join_code) = ?', [cleanCode]);
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
        organization: formatOrganizationRow({ ...org, user_role: memberRows[0].role }),
        team: formatOrganizationRow({ ...org, user_role: memberRows[0].role }),
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
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as members_count
       FROM organizations o WHERE o.id = ?`,
      [org.id]
    );

    res.json({
      message: `Successfully joined organization "${org.name}"!`,
      organization: formatOrganizationRow(updatedOrgRows[0]),
      team: formatOrganizationRow(updatedOrgRows[0]),
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

    const [orgRows] = await pool.query<any[]>('SELECT * FROM organizations WHERE id = ?', [orgId]);
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
    const resolvedUserRole = org.created_by === userId ? 'owner' : (userMembership?.role || 'member');

    const formattedOrg = {
      ...formatOrganizationRow({ ...org, user_role: resolvedUserRole, members_count: members.length }),
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

// PUT /api/v1/organizations/:id - Update organization name/desc (only manager)
organizationsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isManager = await isOrganizationManager(userId, orgId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only organization managers can update organization settings' });
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

    const [updatedRows] = await pool.query<any[]>('SELECT * FROM organizations WHERE id = ?', [orgId]);
    res.json(formatOrganizationRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update organization', detail: err.message });
  }
});

// POST /api/v1/organizations/:id/regenerate-token - Regenerate join token (only manager)
organizationsRouter.post('/:id/regenerate-token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.params.id;

    const isManager = await isOrganizationManager(userId, orgId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only organization managers can regenerate the organization join token' });
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

// POST /api/v1/organizations/:id/members - Add member by userId or username (only manager)
organizationsRouter.post('/:id/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const orgId = req.params.id;

    const isManager = await isOrganizationManager(currentUserId, orgId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only organization managers can add new members' });
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

// PUT /api/v1/organizations/:id/members/:targetUserId - Update member role (Owner / Manager check)
organizationsRouter.put('/:id/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const orgId = req.params.id;
    const targetUserId = req.params.targetUserId;

    const isManager = await isOrganizationManager(currentUserId, orgId);
    if (!isManager) {
      return res.status(403).json({ error: 'Only organization managers or owners can change member roles' });
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

    // Allow user to leave organization OR manager/owner to remove member
    const isManager = await isOrganizationManager(currentUserId, orgId);
    if (currentUserId !== targetUserId && !isManager) {
      return res.status(403).json({ error: 'Only organization managers or owners can remove other members' });
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

// Compatibility alias
export const teamsRouter = organizationsRouter;
