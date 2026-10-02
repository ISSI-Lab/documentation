# Session & Machine Handoff: Strict Team vs. Individual Project Association

- **Date**: 2026-10-02
- **Author**: Antigravity AI Assistant
- **Branch**: `main`
- **Machine**: macOS (`/Users/hchang/MyDevDrive/workspace/project/documentation`)

---

## 1. What Was Completed
- **Elimination of Hybrid Association (Strict Mutual Exclusion)**:
  - Formulated and implemented the strict architectural rule: a project is either team-assigned (via squads/reusable set) or individually-assigned (via organization members), never both simultaneously.
- **Relational Schema & Startup Migrations**:
  - `src/backend/db/init.sql` & `src/backend/src/db.ts`:
    - Added `association_type ENUM('team', 'individual') NOT NULL DEFAULT 'team'` to `projects` table.
    - Added table `project_individual_members` (`id`, `project_id`, `user_id`, `role`, `assigned_at`, `UNIQUE KEY (project_id, user_id)`).
    - Added dynamic startup column migration in `db.ts` via `ensureColumnExists`.
- **Backend API Endpoints (`src/backend/src/routes/projects.ts`)**:
  - `PUT /api/v1/projects/:id/assignment-mode`: Atomic endpoint to transition projects between `team` and `individual` modes with strict purge of the opposing configuration.
  - `GET /api/v1/projects/:id/individual-members`: List direct project members with user profiles and roles.
  - `POST /api/v1/projects/:id/individual-members`: Assign an organization member to a project with `lead` or `member` role (automatically enforces `association_type = 'individual'`).
  - `PUT /api/v1/projects/:id/individual-members/:memberUserId`: Update member project role.
  - `DELETE /api/v1/projects/:id/individual-members/:memberUserId`: Remove member from project.
  - Enforced mutual exclusion in `PUT /:id/team-assignment-set`, `POST /:id/clone-set`, and `POST /:id/save-as-team-assignment-set`.
  - Added `fetchProjectIndividualMembers` and updated `formatProjectRow`.
- **Frontend API Client & Types (`src/frontend/src/`)**:
  - `src/frontend/src/types/index.ts` & `src/backend/src/models.ts`: Added `ProjectAssociationType = 'team' | 'individual'`, `ProjectIndividualMember`, and augmented `Project`.
  - `src/frontend/src/api/client.ts`: Added `updateProjectAssignmentMode`, `getProjectIndividualMembers`, `addProjectIndividualMember`, `updateProjectIndividualMemberRole`, `removeProjectIndividualMember`.
- **Frontend UI & User Experience Overhaul**:
  - `ProjectTeamAssignmentModal.tsx`:
    - Top segmented mode switcher (`[👥 Team Association (Squads / Set)]` vs `[👤 Individual Association (Members)]`).
    - Explicit confirmation dialog warning users when switching modes that the opposing assignments will be purged.
    - Individual association view: roster of assigned members, avatars, `Project Lead` and `Contributor` badges, role toggle, remove button, and member addition form.
    - Team association view: reusable set selector, clone for project, squad list, reusable set export, and team assignment form.
  - `OrganizationManagement.tsx`:
    - Project creation modal includes mode toggle to choose between Team Assigned and Individual Assigned upon initial creation.
    - Project cards surface distinct badges and member/team chips depending on association mode.
  - `TeamManagement.tsx` & `PersonalHomepage.tsx`:
    - Updated badges and cards to show `Individual Assigned` with member chips or `Team Assigned` with squad chips.
- **Integration Tests & Fallbacks**:
  - Updated `tests/integration/test_team_assignments.py` with full coverage for individual project creation, member assignment, role changes, and mode transitions confirming mutual exclusion.
  - Added zero-dependency fallback to standard library `urllib.request` if `requests` is absent.
- **Documentation**:
  - Updated [ADR-0006](../../memory/decisions/0006-teams-and-reusable-project-team-assignment-sets.md).
  - Updated Context Bank: `system-patterns.md` and `active-context.md`.

## 2. Verification & Testing Status
- TypeScript compilation: passed with 0 errors across backend and frontend (`./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/tsc --project ../frontend/tsconfig.json --noEmit`).
- Integration tests: `python3 tests/integration/test_team_assignments.py` executed cleanly.
- Documentation validation: `python3 scripts/validate_docs.py` passed with 0 errors.

## 3. Immediate Next Steps
1. Launch development servers via `./scripts/start.sh`.
2. Test mode switching and member assignment interactively in the web UI.
