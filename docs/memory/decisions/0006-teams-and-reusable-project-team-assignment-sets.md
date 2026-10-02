# ADR-0006: Team Assignment Sets and Functional Squad Containment Flow

- **Status**: Accepted
- **Date**: 2026-10-02
- **Deciders**: Platform Architecture Team, Engineering

---

## Context
Following the elevation of top-level tenants to organizations ([ADR-0005](0005-refactor-team-domain-to-organization.md)), organizations need fine-grained operational division into functional squads (e.g., Frontend Engineering, Cloud Infrastructure, Security & Compliance).

Crucially, project staffing follows a distinct containment hierarchy:
1. **Team Assignment Sets** are top-level staffing blueprints within an organization.
2. A **Team Assignment Set** contains multiple **Teams** (functional squads).
3. A **Team** contains users from within the organization (assigned squad members with roles such as `lead` or `member`).
4. **Sequence & Flow**: The Team Assignment Set is created first; within the set, functional squads are created and staffed. Projects then associate with a Team Assignment Set.
5. **Reusability & Granularity**: Different projects within the same organization can associate with different Team Assignment Sets or reuse an existing set. Projects can also clone an existing set to customize squads without affecting other projects.

## Decision

### 1. Containment Hierarchy & Relational Schema
We modeled the containment structure in `src/backend/db/init.sql` and `src/backend/src/db.ts`:

- **`team_assignment_sets`**: Primary container created first within an organization (`id`, `organization_id`, `name`, `description`, `created_by`, timestamps).
- **`organization_teams`**: Functional squads created **within** a Team Assignment Set (`id`, `organization_id`, `set_id` foreign key pointing to `team_assignment_sets.id`, `name`, `description`, timestamps).
- **`organization_team_members`**: Organization users assigned to a team within the set (`id`, `team_id`, `user_id`, `role` as `lead` or `member`, `joined_at`).
- **`projects.team_assignment_set_id`**: Foreign key linking a project to its associated `team_assignment_sets` record.
- **`project_team_assignments`**: Realized team assignments for projects, populated from the associated Team Assignment Set.

### 2. Backend REST API Flow
- **Team Assignment Sets Endpoints (`/api/v1/organizations/:id/team-assignment-sets`)**:
  - `GET /api/v1/organizations/:id/team-assignment-sets`: Lists sets with their nested `teams` array and each team's populated `members`.
  - `POST /api/v1/organizations/:id/team-assignment-sets`: Creates a new set (`name`, `description`).
  - `GET /api/v1/organizations/:id/team-assignment-sets/:setId`: Retrieves a single set with its teams and members.
  - `PUT /api/v1/organizations/:id/team-assignment-sets/:setId`: Updates set metadata.
  - `DELETE /api/v1/organizations/:id/team-assignment-sets/:setId`: Deletes the set and cascades deletion to teams created within it.
  - `POST /api/v1/organizations/:id/team-assignment-sets/:setId/clone`: Duplicates an entire set, including all member teams and squad rosters.

- **Teams Within Sets (`/api/v1/organizations/:id/team-assignment-sets/:setId/teams`)**:
  - `POST /api/v1/organizations/:id/team-assignment-sets/:setId/teams`: Creates a functional squad **within** the specified set.
  - `PUT / DELETE /api/v1/organizations/:id/teams/:teamId`: Updates or removes a team.
  - `POST / PUT / DELETE /api/v1/organizations/:id/teams/:teamId/members/:userId`: Adds organization users to a team and manages `lead`/`member` roles.

- **Project Staffing Association (`/api/v1/projects/:id`)**:
  - `PUT /api/v1/projects/:id/team-assignment-set`: Associates/disassociates a project with a set, synchronizing the set's teams to the project.
  - `POST /api/v1/projects/:id/clone-set`: Clones the project's associated set into a dedicated project staffing set for immediate independent customization.
  - `GET /api/v1/projects/:id/teams`: Returns assigned teams, roles, and squad members.

### 3. Frontend Architecture & User Experience
- **Teams & Assignments Hub (`src/frontend/src/components/teams/TeamManagement.tsx`)**:
  - **Tab 1: Team Assignment Sets (Default)**:
    - Lists all sets in the organization.
    - Button: **"+ Create Team Assignment Set"**.
    - For each set, shows included squads, member chips, and quick actions: **"+ Add Team to Set"**, **"Clone Set"**, **"Edit"**, **"Delete"**.
    - Inside each team: shows member avatars, `Lead` / `Member` badges, and **"+ Add Member"** action.
  - **Tab 2: Project Assignments**:
    - Matrix overview displaying all projects, their associated Team Assignment Set, and assigned teams.
    - Actions to change association or clone set for project-specific customization.
- **Interactive Project Team Assignment Modal (`src/frontend/src/components/projects/ProjectTeamAssignmentModal.tsx`)**:
  - Associate or change the project's Team Assignment Set.
  - "Clone for Project" action to fork a set into a dedicated project set.
- **Organization Management & Homepage Integration**:
  - Set association badges and squad tags surfaced across project cards in `OrganizationManagement.tsx` and `PersonalHomepage.tsx`.

## Consequences

### Positive
- **Correct Mental Model & Workflow**: Users create the staffing set first, define functional squads inside it, add users from the organization, and associate sets with projects.
- **High Reusability & Rapid Provisioning**: Common staffing patterns can be saved and reused across multiple projects, or cloned for custom variations.
- **Granular Staffing**: Different projects in the same organization maintain distinct team assignments.

### Negative / Trade-offs
- Deleting a team assignment set cascades to the teams defined within that set, disassociating them from projects.
