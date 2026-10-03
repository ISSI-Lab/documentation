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
  Project,
  ProjectTeamAssignment,
  ProjectIndividualMember,
  ProjectAssociationType,
  ProjectDocumentCreationPermission,
  OrganizationTeamMember,
  TeamAssignmentSet,
} from '../models';

export const projectsRouter = Router();

function formatProjectRow(
  row: any,
  assigned_teams: ProjectTeamAssignment[] = [],
  individual_members: ProjectIndividualMember[] = []
): Project {
  const orgId = row.organization_id || row.team_id || null;
  const assocType: ProjectAssociationType = row.association_type === 'individual' ? 'individual' : 'team';
  const docCreationPerm: ProjectDocumentCreationPermission =
    row.document_creation_permission === 'creator_only' ? 'creator_only' : 'all_members';
  return {
    id: row.id,
    organization_id: orgId,
    team_id: orgId, // compatibility
    association_type: assocType,
    document_creation_permission: docCreationPerm,
    team_assignment_set_id: assocType === 'individual' ? null : (row.team_assignment_set_id || null),
    team_assignment_set_name: assocType === 'individual' ? null : (row.team_assignment_set_name || null),
    name: row.name,
    description: row.description || '',
    created_by: row.created_by,
    creator_name: row.creator_name || undefined,
    creator_username: row.creator_username || undefined,
    documents_count: Number(row.documents_count || 0),
    assigned_teams: assocType === 'team' ? assigned_teams : [],
    individual_members: assocType === 'individual' ? individual_members : [],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

async function fetchProjectIndividualMembers(projectIds: string[]): Promise<Record<string, ProjectIndividualMember[]>> {
  if (projectIds.length === 0) return {};
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT pim.*, u.username, u.name as user_name, u.email as user_email
       FROM project_individual_members pim
       JOIN users u ON pim.user_id = u.id
       WHERE pim.project_id IN (?)
       ORDER BY (pim.role = 'lead') DESC, pim.assigned_at ASC`,
      [projectIds]
    );

    const result: Record<string, ProjectIndividualMember[]> = {};
    for (const r of rows) {
      if (!result[r.project_id]) result[r.project_id] = [];
      result[r.project_id].push({
        id: r.id,
        project_id: r.project_id,
        user_id: r.user_id,
        role: r.role,
        assigned_at: new Date(r.assigned_at).toISOString(),
        user_name: r.user_name || r.username,
        user_email: r.user_email,
      });
    }
    return result;
  } catch (err) {
    console.warn('[Projects] fetchProjectIndividualMembers notice:', err);
    return {};
  }
}

async function fetchProjectTeamAssignments(projectIds: string[]): Promise<Record<string, ProjectTeamAssignment[]>> {
  if (projectIds.length === 0) return {};
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT pta.*, ot.name as team_name, ot.description as team_description,
        (SELECT COUNT(*) FROM organization_team_members WHERE team_id = ot.id) as members_count
       FROM project_team_assignments pta
       JOIN organization_teams ot ON pta.team_id = ot.id
       WHERE pta.project_id IN (?)
       ORDER BY pta.assigned_at ASC`,
      [projectIds]
    );

    const [memberRows] = await pool.query<any[]>(
      `SELECT otm.team_id, otm.user_id, otm.role, otm.joined_at, u.username, u.name, u.email, u.user_type
       FROM organization_team_members otm
       JOIN users u ON otm.user_id = u.id
       WHERE otm.team_id IN (SELECT team_id FROM project_team_assignments WHERE project_id IN (?))
       ORDER BY (otm.role = 'lead') DESC`,
      [projectIds]
    );

    const membersByTeam: Record<string, OrganizationTeamMember[]> = {};
    for (const m of memberRows) {
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

    const result: Record<string, ProjectTeamAssignment[]> = {};
    for (const r of rows) {
      if (!result[r.project_id]) result[r.project_id] = [];
      result[r.project_id].push({
        id: r.id,
        project_id: r.project_id,
        team_id: r.team_id,
        assigned_role: r.assigned_role,
        assigned_at: new Date(r.assigned_at).toISOString(),
        team_name: r.team_name,
        team_description: r.team_description,
        members_count: Number(r.members_count || 0),
        members: membersByTeam[r.team_id] || [],
      });
    }
    return result;
  } catch (err) {
    console.warn('[Projects] fetchProjectTeamAssignments notice:', err);
    return {};
  }
}

// GET /api/v1/projects - List projects (optional ?organization_id=... or ?team_id=...)
projectsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = (req.query.organization_id || req.query.team_id) as string | undefined;

    let sql = `
      SELECT p.*,
        u.name as creator_name,
        u.username as creator_username,
        tas.name as team_assignment_set_name,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
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
    const pIds = rows.map((r) => r.id);
    const assignmentsMap = await fetchProjectTeamAssignments(pIds);
    const individualMap = await fetchProjectIndividualMembers(pIds);

    res.json(rows.map((r) => formatProjectRow(r, assignmentsMap[r.id] || [], individualMap[r.id] || [])));
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
        u.name as creator_name,
        u.username as creator_username,
        tas.name as team_assignment_set_name,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
       WHERE p.id = ? AND (
         (p.organization_id IS NULL AND p.created_by = ?)
         OR (p.organization_id IS NOT NULL AND p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = ?))
       )`,
      [projectId, userId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or you do not have access' });
    }

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json(formatProjectRow(rows[0], assignmentsMap[projectId] || [], individualMap[projectId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project', detail: err.message });
  }
});

// POST /api/v1/projects - Create project in an organization or personal
projectsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { organization_id, team_id, name, description, association_type, document_creation_permission } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const rawOrgId = organization_id || team_id;
    const resolvedOrgId = rawOrgId && typeof rawOrgId === 'string' && rawOrgId.trim() ? rawOrgId.trim() : null;

    if (resolvedOrgId) {
      // Verify user is the organization creator
      const isCreator = await isOrganizationCreator(userId, resolvedOrgId);
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the organization creator can create projects in an organization' });
      }
    }

    const assocType: ProjectAssociationType = association_type === 'individual' ? 'individual' : 'team';
    const docCreationPerm: ProjectDocumentCreationPermission =
      document_creation_permission === 'creator_only' ? 'creator_only' : 'all_members';
    const projectId = `proj-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO projects (id, organization_id, association_type, document_creation_permission, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [projectId, resolvedOrgId, assocType, docCreationPerm, name.trim(), description || '', userId]
    );

    if (assocType === 'individual') {
      const pimId = `pim-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO project_individual_members (id, project_id, user_id, role, assigned_at)
         VALUES (?, ?, ?, 'lead', NOW())`,
        [pimId, projectId, userId]
      );
    }

    const [createdRows] = await pool.query<any[]>(
      `SELECT p.*,
        u.name as creator_name,
        u.username as creator_username,
        0 as documents_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = ?`,
      [projectId]
    );

    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.status(201).json(formatProjectRow(createdRows[0], [], individualMap[projectId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create project', detail: err.message });
  }
});

// PUT /api/v1/projects/:id - Update project
projectsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { name, description, document_creation_permission } = req.body;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isCreator = await isOrganizationCreator(userId, currentOrgId);
      const isProjCreator = current.created_by === userId;
      if (!isCreator && !isProjCreator) {
        return res.status(403).json({ error: 'Only the organization creator can update this organization project' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this personal project' });
    }

    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newDesc = description !== undefined ? description : current.description;
    let newDocCreationPerm = current.document_creation_permission || 'all_members';
    if (document_creation_permission === 'creator_only' || document_creation_permission === 'all_members') {
      newDocCreationPerm = document_creation_permission;
    }

    await pool.query(
      'UPDATE projects SET name = ?, description = ?, document_creation_permission = ?, updated_at = NOW() WHERE id = ?',
      [newName, newDesc, newDocCreationPerm, projectId]
    );

    const [updatedRows] = await pool.query<any[]>(
      `SELECT p.*,
        u.name as creator_name,
        u.username as creator_username,
        tas.name as team_assignment_set_name,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
       WHERE p.id = ?`,
      [projectId]
    );

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json(formatProjectRow(updatedRows[0], assignmentsMap[projectId] || [], individualMap[projectId] || []));
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
      const isCreator = await isOrganizationCreator(userId, currentOrgId);
      if (!isCreator && current.created_by !== userId) {
        return res.status(403).json({ error: 'Only the organization creator can delete organization projects' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this personal project' });
    }

    // Unlink documents and delete assignments
    await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);
    await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);
    await pool.query('DELETE FROM documents WHERE project_id = ?', [projectId]);
    await pool.query('DELETE FROM projects WHERE id = ?', [projectId]);

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete project', detail: err.message });
  }
});

// ==============================================================================
// Project Team Assignments & Set Association Endpoints
// ==============================================================================

// GET /api/v1/projects/:id/teams - Get assigned teams for project
projectsRouter.get('/:id/teams', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;

    const [existing] = await pool.query<any[]>(
      `SELECT p.*, tas.name as team_assignment_set_name
       FROM projects p
       LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
       WHERE p.id = ?`,
      [projectId]
    );

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
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    const assignedTeams = assignmentsMap[projectId] || [];

    res.json({
      project_id: projectId,
      organization_id: currentOrgId,
      team_assignment_set_id: current.team_assignment_set_id || null,
      team_assignment_set_name: current.team_assignment_set_name || null,
      assigned_teams: assignedTeams,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project teams', detail: err.message });
  }
});

// POST /api/v1/projects/:id/teams - Assign a team to project
projectsRouter.post('/:id/teams', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { team_id, assigned_role } = req.body;

    if (!team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (!currentOrgId) {
      return res.status(400).json({ error: 'Team assignments are only supported for organization projects' });
    }

    const isCreator = await isOrganizationCreator(userId, currentOrgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can manage project team assignments' });
    }

    // Verify team belongs to the same organization
    const [teamRows] = await pool.query<any[]>(
      'SELECT * FROM organization_teams WHERE id = ? AND organization_id = ?',
      [team_id, currentOrgId]
    );
    if (!teamRows || teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found in this organization' });
    }

    // Strict mutual exclusion: enforce team association and clear individual members
    await pool.query(
      `UPDATE projects SET association_type = 'team', updated_at = NOW() WHERE id = ?`,
      [projectId]
    );
    await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);

    const ptaId = `pta-${projectId}-${team_id}`;
    await pool.query(
      `INSERT INTO project_team_assignments (id, project_id, team_id, assigned_role, assigned_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE assigned_role = VALUES(assigned_role)`,
      [ptaId, projectId, team_id, assigned_role || null]
    );

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    res.status(201).json({
      message: 'Team assigned to project successfully',
      assigned_teams: assignmentsMap[projectId] || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to assign team to project', detail: err.message });
  }
});

// DELETE /api/v1/projects/:id/teams/:teamId - Remove a team from project (only organization creator)
projectsRouter.delete('/:id/teams/:teamId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: projectId, teamId } = req.params;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isCreator = await isOrganizationCreator(userId, currentOrgId);
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the organization creator can manage project team assignments' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    await pool.query(
      'DELETE FROM project_team_assignments WHERE project_id = ? AND team_id = ?',
      [projectId, teamId]
    );

    res.json({ message: 'Team unassigned from project' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unassign team from project', detail: err.message });
  }
});

// PUT /api/v1/projects/:id/team-assignment-set - Associate project with a team assignment set (only organization creator)
projectsRouter.put('/:id/team-assignment-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { team_assignment_set_id, apply_teams } = req.body;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (!currentOrgId) {
      return res.status(400).json({ error: 'Team assignment sets can only be associated with organization projects' });
    }

    const isCreator = await isOrganizationCreator(userId, currentOrgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can associate team formations with projects' });
    }

    if (team_assignment_set_id) {
      // Validate set exists in same organization
      const [setRows] = await pool.query<any[]>(
        'SELECT * FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
        [team_assignment_set_id, currentOrgId]
      );
      if (!setRows || setRows.length === 0) {
        return res.status(404).json({ error: 'Team assignment set not found in this organization' });
      }

      // Strict mutual exclusion: set association_type to team, set ID, and delete individual members
      await pool.query(
        "UPDATE projects SET association_type = 'team', team_assignment_set_id = ?, updated_at = NOW() WHERE id = ?",
        [team_assignment_set_id, projectId]
      );
      await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);

      // If apply_teams is true (default true), sync teams from set into project_team_assignments
      if (apply_teams !== false) {
        const [teamsInSet] = await pool.query<any[]>(
          `SELECT DISTINCT t.id, tasi.assigned_role
           FROM organization_teams t
           LEFT JOIN team_assignment_set_items tasi ON t.id = tasi.team_id AND tasi.set_id = ?
           WHERE t.set_id = ? OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id = ?)`,
          [team_assignment_set_id, team_assignment_set_id, team_assignment_set_id]
        );

        await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);
        for (const item of teamsInSet) {
          const ptaId = `pta-${projectId}-${item.id}`;
          await pool.query(
            `INSERT INTO project_team_assignments (id, project_id, team_id, assigned_role, assigned_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE assigned_role = VALUES(assigned_role)`,
            [ptaId, projectId, item.id, item.assigned_role || null]
          );
        }
      }
    } else {
      // Disassociate set
      await pool.query(
        'UPDATE projects SET team_assignment_set_id = NULL, updated_at = NOW() WHERE id = ?',
        [projectId]
      );
      if (req.body.clear_teams !== false) {
        await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);
      }
    }

    const [updatedRows] = await pool.query<any[]>(
      `SELECT p.*,
        u.name as creator_name,
        u.username as creator_username,
        tas.name as team_assignment_set_name,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
       WHERE p.id = ?`,
      [projectId]
    );

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json(formatProjectRow(updatedRows[0], assignmentsMap[projectId] || [], individualMap[projectId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to associate team assignment set with project', detail: err.message });
  }
});

// POST /api/v1/projects/:id/clone-set - Clone current set or specified set specifically for this project
projectsRouter.post('/:id/clone-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { name, description, source_set_id } = req.body;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (!currentOrgId) {
      return res.status(400).json({ error: 'Only organization projects can clone team assignment sets' });
    }

    const isCreator = await isOrganizationCreator(userId, currentOrgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can clone team formations for projects' });
    }

    const targetSourceSetId = source_set_id || current.team_assignment_set_id;
    if (!targetSourceSetId) {
      return res.status(400).json({ error: 'No source team assignment set found to clone' });
    }

    const [setRows] = await pool.query<any[]>(
      'SELECT * FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
      [targetSourceSetId, currentOrgId]
    );
    if (!setRows || setRows.length === 0) {
      return res.status(404).json({ error: 'Source team assignment set not found' });
    }

    const source = setRows[0];
    const newSetName = name?.trim() || `${current.name} Staffing Formation`;
    const newSetDesc = description !== undefined ? description : `Dedicated staffing formation cloned from ${source.name} for ${current.name}`;
    const newSetId = `set-${crypto.randomBytes(4).toString('hex')}`;

    // Create cloned set
    await pool.query(
      `INSERT INTO team_assignment_sets (id, organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [newSetId, currentOrgId, newSetName, newSetDesc, userId]
    );

    // Fetch source teams
    const [sourceTeams] = await pool.query<any[]>(
      `SELECT t.* FROM organization_teams t
       WHERE t.set_id = ? OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id = ?)`,
      [targetSourceSetId, targetSourceSetId]
    );

    await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);

    // Clone teams and members
    for (const st of sourceTeams) {
      const newTeamId = `team-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO organization_teams (id, organization_id, set_id, name, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [newTeamId, currentOrgId, newSetId, st.name, st.description || '', userId]
      );

      await pool.query(
        `INSERT INTO team_assignment_set_items (set_id, team_id)
         VALUES (?, ?)`,
        [newSetId, newTeamId]
      );

      const [members] = await pool.query<any[]>(
        'SELECT * FROM organization_team_members WHERE team_id = ?',
        [st.id]
      );
      for (const m of members) {
        await pool.query(
          `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
           VALUES (?, ?, ?, NOW())`,
          [newTeamId, m.user_id, m.role]
        );
      }

      // Assign to project
      const ptaId = `pta-${projectId}-${newTeamId}`;
      await pool.query(
        `INSERT INTO project_team_assignments (id, project_id, team_id, assigned_at)
         VALUES (?, ?, ?, NOW())`,
        [ptaId, projectId, newTeamId]
      );
    }

    // Update project pointer and enforce team association
    await pool.query(
      "UPDATE projects SET association_type = 'team', team_assignment_set_id = ?, updated_at = NOW() WHERE id = ?",
      [newSetId, projectId]
    );
    await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);

    const [updatedRows] = await pool.query<any[]>(
      `SELECT p.*,
        u.name as creator_name,
        u.username as creator_username,
        tas.name as team_assignment_set_name,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
       WHERE p.id = ?`,
      [projectId]
    );

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    res.status(201).json(formatProjectRow(updatedRows[0], assignmentsMap[projectId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to clone set for project', detail: err.message });
  }
});

// POST /api/v1/projects/:id/save-as-team-assignment-set - Allow project team assignments to be saved/reused as a set (only organization creator)
projectsRouter.post('/:id/save-as-team-assignment-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team assignment set name is required' });
    }

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (!currentOrgId) {
      return res.status(400).json({ error: 'Only organization projects can export team assignment sets' });
    }

    const isCreator = await isOrganizationCreator(userId, currentOrgId);
    if (!isCreator) {
      return res.status(403).json({ error: 'Only the organization creator can save project team assignments as a formation' });
    }

    // Get current assigned teams for this project
    const [assigned] = await pool.query<any[]>(
      'SELECT * FROM project_team_assignments WHERE project_id = ?',
      [projectId]
    );

    if (!assigned || assigned.length === 0) {
      return res.status(400).json({
        error: 'This project currently has no assigned teams. Assign at least one team before saving as a reusable set.',
      });
    }

    const setId = `set-${crypto.randomBytes(4).toString('hex')}`;

    // Create the team assignment set in organization
    await pool.query(
      `INSERT INTO team_assignment_sets (id, organization_id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [setId, currentOrgId, name.trim(), description || '', userId]
    );

    // Copy project's team assignments into set items
    for (const a of assigned) {
      await pool.query(
        `INSERT INTO team_assignment_set_items (set_id, team_id, assigned_role)
         VALUES (?, ?, ?)`,
        [setId, a.team_id, a.assigned_role || null]
      );
    }

    // Associate this project with the newly saved set and enforce team association
    await pool.query(
      "UPDATE projects SET association_type = 'team', team_assignment_set_id = ?, updated_at = NOW() WHERE id = ?",
      [setId, projectId]
    );
    await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);

    // Retrieve created set details
    const [setRows] = await pool.query<any[]>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM team_assignment_set_items WHERE set_id = s.id) as teams_count,
        1 as associated_projects_count
       FROM team_assignment_sets s WHERE s.id = ?`,
      [setId]
    );

    const [itemRows] = await pool.query<any[]>(
      `SELECT tasi.*, ot.name as team_name, ot.description as team_description,
        (SELECT COUNT(*) FROM organization_team_members WHERE team_id = ot.id) as members_count
       FROM team_assignment_set_items tasi
       JOIN organization_teams ot ON tasi.team_id = ot.id
       WHERE tasi.set_id = ?`,
      [setId]
    );

    const createdSet: TeamAssignmentSet = {
      id: setRows[0].id,
      organization_id: setRows[0].organization_id,
      name: setRows[0].name,
      description: setRows[0].description || '',
      created_by: setRows[0].created_by,
      teams_count: Number(setRows[0].teams_count || 0),
      associated_projects_count: 1,
      items: itemRows.map((it) => ({
        set_id: it.set_id,
        team_id: it.team_id,
        assigned_role: it.assigned_role,
        team_name: it.team_name,
        team_description: it.team_description,
        members_count: Number(it.members_count || 0),
      })),
      created_at: new Date(setRows[0].created_at).toISOString(),
      updated_at: new Date(setRows[0].updated_at).toISOString(),
    };

    res.status(201).json({
      message: `Team assignments saved as reusable formation "${name.trim()}"!`,
      set: createdSet,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save project team assignments as reusable formation', detail: err.message });
  }
});

// ==============================================================================
// Project Association Mode & Individual Members Endpoints
// ==============================================================================

// PUT /api/v1/projects/:id/assignment-mode - Switch between 'team' and 'individual' association
projectsRouter.put('/:id/assignment-mode', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { association_type, team_assignment_set_id, members } = req.body;

    if (association_type !== 'team' && association_type !== 'individual') {
      return res.status(400).json({ error: 'association_type must be either "team" or "individual"' });
    }

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
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    if (association_type === 'individual') {
      // Strict mutual exclusion: purge team assignments and remove set pointer
      await pool.query(
        "UPDATE projects SET association_type = 'individual', team_assignment_set_id = NULL, updated_at = NOW() WHERE id = ?",
        [projectId]
      );
      await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);

      // If explicit members provided, replace individual members
      if (Array.isArray(members)) {
        await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);
        for (const m of members) {
          if (m && m.user_id) {
            const pimId = `pim-${crypto.randomBytes(4).toString('hex')}`;
            await pool.query(
              `INSERT INTO project_individual_members (id, project_id, user_id, role, assigned_at)
               VALUES (?, ?, ?, ?, NOW())
               ON DUPLICATE KEY UPDATE role = VALUES(role)`,
              [pimId, projectId, m.user_id, m.role === 'lead' ? 'lead' : 'member']
            );
          }
        }
      } else {
        // If switching to individual and no members passed and table is empty, seed user as lead
        const [existingCount] = await pool.query<any[]>(
          'SELECT COUNT(*) as cnt FROM project_individual_members WHERE project_id = ?',
          [projectId]
        );
        if (existingCount[0]?.cnt === 0) {
          const pimId = `pim-${crypto.randomBytes(4).toString('hex')}`;
          await pool.query(
            `INSERT INTO project_individual_members (id, project_id, user_id, role, assigned_at)
             VALUES (?, ?, ?, 'lead', NOW())`,
            [pimId, projectId, userId]
          );
        }
      }
    } else {
      // association_type === 'team'
      // Strict mutual exclusion: purge individual members
      await pool.query('DELETE FROM project_individual_members WHERE project_id = ?', [projectId]);

      if (team_assignment_set_id) {
        if (!currentOrgId) {
          return res.status(400).json({ error: 'Team assignment sets can only be associated with organization projects' });
        }
        const [setRows] = await pool.query<any[]>(
          'SELECT * FROM team_assignment_sets WHERE id = ? AND organization_id = ?',
          [team_assignment_set_id, currentOrgId]
        );
        if (!setRows || setRows.length === 0) {
          return res.status(404).json({ error: 'Team assignment set not found in this organization' });
        }

        await pool.query(
          "UPDATE projects SET association_type = 'team', team_assignment_set_id = ?, updated_at = NOW() WHERE id = ?",
          [team_assignment_set_id, projectId]
        );

        // Sync teams from set
        const [teamsInSet] = await pool.query<any[]>(
          `SELECT DISTINCT t.id, tasi.assigned_role
           FROM organization_teams t
           LEFT JOIN team_assignment_set_items tasi ON t.id = tasi.team_id AND tasi.set_id = ?
           WHERE t.set_id = ? OR t.id IN (SELECT team_id FROM team_assignment_set_items WHERE set_id = ?)`,
          [team_assignment_set_id, team_assignment_set_id, team_assignment_set_id]
        );

        await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);
        for (const item of teamsInSet) {
          const ptaId = `pta-${projectId}-${item.id}`;
          await pool.query(
            `INSERT INTO project_team_assignments (id, project_id, team_id, assigned_role, assigned_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE assigned_role = VALUES(assigned_role)`,
            [ptaId, projectId, item.id, item.assigned_role || null]
          );
        }
      } else {
        await pool.query(
          "UPDATE projects SET association_type = 'team', team_assignment_set_id = NULL, updated_at = NOW() WHERE id = ?",
          [projectId]
        );
        await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);
      }
    }

    const [updatedRows] = await pool.query<any[]>(
      `SELECT p.*,
        u.name as creator_name,
        u.username as creator_username,
        tas.name as team_assignment_set_name,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as documents_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN team_assignment_sets tas ON p.team_assignment_set_id = tas.id
       WHERE p.id = ?`,
      [projectId]
    );

    const assignmentsMap = await fetchProjectTeamAssignments([projectId]);
    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json(formatProjectRow(updatedRows[0], assignmentsMap[projectId] || [], individualMap[projectId] || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update project assignment mode', detail: err.message });
  }
});

// GET /api/v1/projects/:id/individual-members - List individual members assigned to project
projectsRouter.get('/:id/individual-members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
      const isMember = await isOrganizationMember(userId, currentOrgId);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of the organization for this project' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json({
      project_id: projectId,
      association_type: current.association_type || 'team',
      individual_members: individualMap[projectId] || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project individual members', detail: err.message });
  }
});

// POST /api/v1/projects/:id/individual-members - Add/assign an individual member to project
projectsRouter.post('/:id/individual-members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    const { user_id: memberUserId, role } = req.body;

    if (!memberUserId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isCreator = await isOrganizationCreator(userId, currentOrgId);
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the organization creator can manage project member assignments' });
      }
      // Check target member belongs to the organization
      const targetIsMember = await isOrganizationMember(memberUserId, currentOrgId);
      if (!targetIsMember) {
        return res.status(400).json({ error: 'Target user is not a member of this organization' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    // Strict mutual exclusion: ensure association_type is 'individual' and clear team assignments
    await pool.query(
      "UPDATE projects SET association_type = 'individual', team_assignment_set_id = NULL, updated_at = NOW() WHERE id = ?",
      [projectId]
    );
    await pool.query('DELETE FROM project_team_assignments WHERE project_id = ?', [projectId]);

    const pimId = `pim-${crypto.randomBytes(4).toString('hex')}`;
    const memberRole = role === 'lead' ? 'lead' : 'member';

    await pool.query(
      `INSERT INTO project_individual_members (id, project_id, user_id, role, assigned_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [pimId, projectId, memberUserId, memberRole]
    );

    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.status(201).json({
      message: 'Individual member assigned successfully',
      individual_members: individualMap[projectId] || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to assign individual member', detail: err.message });
  }
});

// PUT /api/v1/projects/:id/individual-members/:memberUserId - Update role of an individual member (only creator)
projectsRouter.put('/:id/individual-members/:memberUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: projectId, memberUserId } = req.params;
    const { role } = req.body;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isCreator = await isOrganizationCreator(userId, currentOrgId);
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the organization creator can manage project member assignments' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    const memberRole = role === 'lead' ? 'lead' : 'member';
    await pool.query(
      'UPDATE project_individual_members SET role = ? WHERE project_id = ? AND user_id = ?',
      [memberRole, projectId, memberUserId]
    );

    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json({
      message: 'Individual member role updated',
      individual_members: individualMap[projectId] || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update individual member role', detail: err.message });
  }
});

// DELETE /api/v1/projects/:id/individual-members/:memberUserId - Remove an individual member from project (only creator)
projectsRouter.delete('/:id/individual-members/:memberUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: projectId, memberUserId } = req.params;

    const [existing] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const current = existing[0];
    const currentOrgId = current.organization_id || current.team_id;
    if (currentOrgId) {
      const isCreator = await isOrganizationCreator(userId, currentOrgId);
      if (!isCreator) {
        return res.status(403).json({ error: 'Only the organization creator can manage project member assignments' });
      }
    } else if (current.created_by !== userId) {
      return res.status(403).json({ error: 'You do not have access to this personal project' });
    }

    await pool.query(
      'DELETE FROM project_individual_members WHERE project_id = ? AND user_id = ?',
      [projectId, memberUserId]
    );

    const individualMap = await fetchProjectIndividualMembers([projectId]);
    res.json({
      message: 'Individual member removed from project',
      individual_members: individualMap[projectId] || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove individual member', detail: err.message });
  }
});

