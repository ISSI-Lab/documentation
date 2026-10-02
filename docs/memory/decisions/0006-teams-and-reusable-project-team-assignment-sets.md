# ADR-0006: Teams and Reusable Project Team Assignment Sets

- **Status**: Accepted
- **Date**: 2026-10-02
- **Deciders**: Platform Architecture Team, Engineering

---

## Context
Following the elevation of top-level tenants to organizations ([ADR-0005](0005-refactor-team-domain-to-organization.md)), organizations need fine-grained operational division into functional and cross-functional teams (e.g., Frontend Engineering, Cloud Infrastructure, Security & Compliance).

Furthermore, projects within an organization require flexible staffing:
1. Different projects within the same organization must be able to assign different teams based on scope and requirements.
2. In large organizations with repeated project archetypes (such as standard full-stack web applications, microservices, or compliance audits), manual team-by-team assignment on every project is repetitive and error-prone.
3. Organizations need reusable "Team Assignment Sets" (templates of team assignments) that can be defined once and associated with projects, while still allowing projects to save their current custom team setup as a new reusable organization set.

## Decision

### 1. Relational Schema & Data Modeling
We introduced five relational entities with foreign keys and cascade rules in `src/backend/db/init.sql` and dynamic self-healing migrations in `src/backend/src/db.ts`:

- **`organization_teams`**: Represents functional squads within an organization (`id`, `organization_id`, `name`, `description`, `created_by`, `created_at`, `updated_at`).
- **`organization_team_members`**: Maps organization users into teams with designated squad roles (`id`, `team_id`, `user_id`, `assigned_role` such as `lead` or `member`, timestamps).
- **`team_assignment_sets`**: Reusable templates defining a collection of teams within an organization (`id`, `organization_id`, `name`, `description`, `created_by`, `created_at`, `updated_at`).
- **`team_assignment_set_items`**: Associates teams to an assignment set with optional configuration notes (`id`, `set_id`, `team_id`, `notes`, `created_at`).
- **`project_team_assignments`**: Realizes the assignment of a team to a specific project (`id`, `project_id`, `team_id`, `assigned_role`, `notes`, `assigned_at`).
- **`projects.team_assignment_set_id`**: An optional reference pointing to the active `team_assignment_sets` record that was associated with or applied to the project.

### 2. Backend REST API Extensions
- **Teams Management (`/api/v1/organizations/:id/teams`)**:
  - `GET /api/v1/organizations/:id/teams`: Lists organization teams with member counts and populated member profiles.
  - `POST /api/v1/organizations/:id/teams`: Creates a new team (Organization Manager or Owner only).
  - `GET /api/v1/organizations/:id/teams/:teamId`: Retrieves team details with member listings.
  - `PUT /api/v1/organizations/:id/teams/:teamId`: Updates team name or description.
  - `DELETE /api/v1/organizations/:id/teams/:teamId`: Removes a team and cascades assignments.
  - `POST /api/v1/organizations/:id/teams/:teamId/members`: Adds a member with role (`lead` or `member`).
  - `PUT /api/v1/organizations/:id/teams/:teamId/members/:userId`: Updates member role.
  - `DELETE /api/v1/organizations/:id/teams/:teamId/members/:userId`: Removes member from team.

- **Reusable Team Assignment Sets (`/api/v1/organizations/:id/team-assignment-sets`)**:
  - `GET /api/v1/organizations/:id/team-assignment-sets`: Lists reusable assignment sets with item arrays and team metadata.
  - `POST /api/v1/organizations/:id/team-assignment-sets`: Creates a set and inserts initial member teams.
  - `GET /api/v1/organizations/:id/team-assignment-sets/:setId`: Retrieves single set details.
  - `PUT /api/v1/organizations/:id/team-assignment-sets/:setId`: Updates set metadata and synchronizes member teams.
  - `DELETE /api/v1/organizations/:id/team-assignment-sets/:setId`: Deletes an assignment set (sets associated projects' `team_assignment_set_id` to `NULL`).

- **Project Team Assignments (`/api/v1/projects/:id`)**:
  - `GET /api/v1/projects/:id/teams`: Returns assigned teams with member count, assignment roles, and notes.
  - `POST /api/v1/projects/:id/teams`: Assigns an individual team to the project.
  - `DELETE /api/v1/projects/:id/teams/:teamId`: Removes a team from the project.
  - `PUT /api/v1/projects/:id/team-assignment-set`: Associates a team assignment set with the project, with an option to instantly replace or populate the project's assigned teams with the set's teams.
  - `POST /api/v1/projects/:id/save-as-team-assignment-set`: Exports the project's current team assignments as a new reusable organization set.

### 3. Frontend Architecture & User Interface
- **Dedicated Teams & Assignment Sets Page (`src/frontend/src/components/teams/TeamManagement.tsx`)**:
  - Standalone top-level route accessible via the main navigation bar.
  - Three distinct management tabs:
    1. **Teams**: Create new teams, manage membership, assign lead/member roles, and view descriptions.
    2. **Reusable Sets**: Create and edit reusable team assignment sets, configure included teams, and inspect usage.
    3. **Project Assignments**: High-level matrix view displaying all projects, their associated assignment sets, and currently assigned teams.
- **Embedded Organization Tabs (`src/frontend/src/components/organizations/OrganizationManagement.tsx`)**:
  - Extended organization management modal/page with integrated "Teams" and "Assignment Sets" tabs.
  - Project cards enhanced with badges displaying associated team assignment sets and assigned team tags, with a direct "Manage Teams" trigger.
- **Interactive Project Team Assignment Modal (`src/frontend/src/components/projects/ProjectTeamAssignmentModal.tsx`)**:
  - Allows team assignment modification directly in-context.
  - Enables one-click application of reusable assignment sets.
  - Enables "Save As New Assignment Set" to capture project staffing patterns into reusable organizational knowledge.
- **Personal Homepage Visibility (`src/frontend/src/components/home/PersonalHomepage.tsx`)**:
  - Quick action buttons to jump to "Teams & Sets".
  - Project summary cards visibly surface assigned teams and set association badges.

## Consequences

### Positive
- **Granular Staffing**: Projects are no longer tied to coarse whole-organization boundaries; specific squads can be assigned to specific projects.
- **High Reusability & Rapid Provisioning**: Common project configurations can be saved as assignment sets and applied in a single click to new projects.
- **Two-Way Flow**: Projects can adopt existing sets, or organic project team compositions can be published upward as reusable organization sets.
- **Self-Healing & Cross-Platform**: Database migrations check column and table existence dynamically on boot, working identically on local MySQL and Docker containers.

### Negative / Trade-offs
- Added relational complexity across 5 additional tables.
- Disassociating a project from an assignment set leaves existing assigned teams intact unless explicitly overwritten by the user.
