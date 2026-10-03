# Shared AI Context Bank: Active Workstreams & Sprint State

This file tracks the current sprint state, active workstreams, and recent changes so any developer or AI assistant starting a new session immediately understands what is in progress.

---

## Current Sprint Focus
- **Goal**: Full-stack User Authentication, Democratic Organization & Project Collaboration, Guest-accessible Public Template Pool, Personal Homepage Dashboard, and Scoped Document Authoring.
- **Active Branch**: `main`

---

## Active Workstreams
| Workstream | Owner | Status | Current Focus |
| :--- | :--- | :--- | :--- |
| Project Scaffolding | Team | Completed | Root layout, docs hub, Docker Compose orchestration |
| MySQL Database | AI Agent | Completed | Schema DDL (`init.sql`), persistent volume, user auth, organizations, projects, templates, and documents tables |
| Backend Service | AI Agent | Completed | Node 20 / Express API, JWT auth, bcrypt hashing, organization/project RBAC, template & document CRUD |
| Frontend Service | AI Agent | Completed | Personal Homepage, Public Template Pool, Document Dashboard, Auth Modal, Account Modal, Organization Management |
| Host & Container Proxy | AI Agent | Completed | Container Nginx port `3939`, reverse proxy `/api/`, production Host Nginx guide |
| Email Service & Registration | AI Agent | Completed | AES-256-GCM `email_config.json`, default `EMAIL_CONFIG_SECRET`, CLI wizard (`scripts/setup_email.sh`), Docker integration in `scripts/start.sh`, verification email dispatch |
| Organization Domain Refactoring | AI Agent | Completed | Elevated teams to top-level organizations across DB schemas, backend APIs, frontend UI, and tests to prepare for future nested sub-teams ([ADR-0005](../decisions/0005-refactor-team-domain-to-organization.md)) |
| Organization Teams & Assignment Sets | AI Agent | Completed | Implemented functional sub-teams within organizations, per-project team assignments, and reusable organization-wide team assignment sets with project association and export capabilities ([ADR-0006](../decisions/0006-teams-and-reusable-project-team-assignment-sets.md)) |
| Strict Team vs Individual Project Association | AI Agent | Completed | Implemented strictly mutually exclusive project association (Team vs. Individual, zero hybrid), database schemas, transition safeguards, and roster management ([ADR-0006](../decisions/0006-teams-and-reusable-project-team-assignment-sets.md)) |
| Team Formation Nomenclature Standard | AI Agent | Completed | Standardized user-facing UI labels, toasts, modals, badges, and navigation links to "Team Formation" / "Formation" across all views ([ADR-0006](../decisions/0006-teams-and-reusable-project-team-assignment-sets.md)) |
| Personal & Team Document Submissions | AI Agent | Completed | Implemented personal & team shared document types, submittable deliverables, pre-populated submission drafts, creator review roster, status tracking, and feedback threads ([ADR-0007](../decisions/0007-personal-and-team-document-submissions-and-review-system.md)) |
| Individual vs Team Project Document Alignment | AI Agent | Completed | Enforced strict alignment: projects with individual association strictly allow personal documents (individual submissions only); team formation projects allow both personal and shared documents; creator-only collaboration and submission controls; in-editor submission button |
| Project & Document Creator Permissions & Team Formations | AI Agent | Completed | Enforced organization creator/owner project creation authority, configurable project document creation permissions (`creator_only` vs `all_members`), document creator review roster isolation, and non-creator guardrails across UI and API |
| Organization & Team Formation Unification with Role Separation | AI Agent | Completed | Combined organization workspace with in-situ team formation; enforced strict role separation where Organization Creator forms teams, manages sets, and creates projects, while Organization Members have view-only access across projects, formations, and staffing ([ADR-0006](../decisions/0006-teams-and-reusable-project-team-assignment-sets.md)) |
| Global Top Navbar Organization Switcher | AI Agent | Completed | Added persistent top navbar organization switcher dropdown with Creator/Member badge indicators, quick navigation to organization creation, and reactive global syncing across documents, templates, projects, and team formations |
| Dedicated Project Page & Staffing Migration | AI Agent | Completed | Migrated project assignments and staffing from Team Formation to dedicated Project Page (`ProjectManagement.tsx`) with in-situ organization switching (Creator vs Member), project CRUD, team set cloning, and staffing modals |

---

## Recent Significant Decisions
- Adopted multi-tier architecture: Host Nginx -> Container Nginx + ReactJS -> NodeJS -> MySQL ([ADR-0003](../decisions/0003-host-nginx-container-react-node-mysql-architecture.md)).
- Implemented user authentication, open team creation with Owner/Manager/Member roles, scoped asset visibility, and personal homepage dashboard ([ADR-0004](../decisions/0004-user-authentication-and-hierarchical-team-collaboration.md)).
- Refactored top-level collaborative tenant from Team to Organization to facilitate nested sub-teams in future phases ([ADR-0005](../decisions/0005-refactor-team-domain-to-organization.md)).
- Designed and built sub-teams in organizations, granular project team assignments, and reusable organization-wide Team Assignment Sets ([ADR-0006](../decisions/0006-teams-and-reusable-project-team-assignment-sets.md)).
- Enforced strict mutual exclusion between Team and Individual project association (explicitly disallowing hybrid models), guaranteeing unambiguous project ownership and staffing.
- Implemented user registration account verification token flow with strict 30-second token expiration and resend capabilities.
- Added encrypted email configuration file (`src/backend/config/email_config.json`) with `smtp.appunity.net` defaults, managed via `scripts/setup_email.sh` / `scripts/manage_email_config.py`, auto-loaded by `scripts/start.sh`, and documented in [`docs/memory/runbooks/email-configuration-guide.md`](../runbooks/email-configuration-guide.md).
- Consolidated startup and deployment automation into `scripts/start.sh` (defaulting to development with phpMyAdmin on port `28080`, and `--prod` for production).
- Implemented automatic host port collision detection and auto-reallocation in `scripts/start.sh` to prevent `port is already allocated` errors across different developer machines.
- Automated Host Nginx site configuration (`/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/`), Certbot SSL bootstrapping/issuance, and Host Nginx restarting in `scripts/start.sh --prod --init`.
- Implemented personal vs project shared document types with submittable deliverables, supporting individual member submissions for personal documents and team-based shared submissions for project shared documents, complete with creator review rosters, status transitions, and interactive feedback threads ([ADR-0007](../decisions/0007-personal-and-team-document-submissions-and-review-system.md)).
- Enforced strict consistency between project association types and document collaboration types: documents under individual projects strictly permit Personal Documents (each individual submits their own deliverable), while documents under team formation projects permit both Personal Documents (individual member deliverables) and Project Shared Documents (team-based deliverables). Enforced that only document creators can modify collaboration types or toggle submissions, and surfaced a direct "Submission" button in the document editor header.
- Streamlined document creation workflow by eliminating the redundant "Document Ownership and Scope" card selector in favor of a clean Workspace Location dropdown, leaving a single, unambiguous "Document Type & Collaboration" selector strictly constrained by project association type.
- Enforced role boundaries and permissions across Project Creators, Document Creators, and Team Formations:
  1. Only organization creators, owners, and managers can create projects.
  2. Project creators can configure project document creation permissions as `"creator_only"` (owner/creator only) or `"all_members"` (each member).
  3. In `creator_only` projects, non-creator organization members are blocked (403 Forbidden) and locked in the UI from creating documents.
  4. In `all_members` projects, any organization member can create documents, and the authoring member becomes the document creator (`document.created_by = user.id`).
  5. Only the document creator can change collaboration type or toggle submissions.
  6. Submissions review rosters are restricted to the document creator (and org managers). Regular members can only see and edit their own personal submission or their assigned team's submission.
- Unified Organization Workspace with in-situ Team Formation & Role Separation:
  1. Integrated Team Formation and squad creation directly within `OrganizationManagement.tsx` so the Organization Creator can form teams and reusable assignment sets without context switching.
  2. Strict Role Distinction between Organization Creator and Organization Member:
     - **Organization Creator** (`org.created_by = user.id`): Exclusive authority to create and update organizations, form teams within sets, manage assignment sets, create projects, assign project staffing (Team vs. Individual), regenerate join tokens, and manage member roles.
     - **Organization Member**: When entering an organization where they are not the creator, the member cannot create teams, cannot create assignment sets, and cannot create projects. Members have view-only access across projects, team formations, and project documents.
  3. Full-Stack Guardrails: Backend routes in `organizations.ts` and `projects.ts` enforce `isOrganizationCreator(userId, orgId)` returning `403 Forbidden` on mutation attempts by non-creators. Frontend views (`OrganizationManagement`, `TeamManagement`, `ProjectTeamAssignmentModal`, `PersonalHomepage`) conditionally render mutation controls exclusively for creators and render informational view-only banners attributing management to the organization creator.
- Persistent Top Navbar Organization Switcher & Cross-Page State Alignment:
  1. Implemented a prominent Organization Switcher in `Navigation.tsx` immediately adjacent to the brand logo on the top bar. It displays the active organization, a Creator (Crown) vs Member (Users) role badge, active selection indicators, and a direct button to go to the Organizations page to create or join organizations.
  2. Integrated reactive `useEffect` synchronization in `DocumentList.tsx` and `TemplateList.tsx` so that changing the organization from the top navbar automatically switches views to the organization scope and loads matching documents and templates.
  3. Extracted project assignment and staffing overview from the Team Formation page to a dedicated Project Management view (`ProjectManagement.tsx`). The Project page includes on-page organization switching with clear Creator vs. Member badges, project CRUD controls guarded by creator authority, and modal staffing configuration.
  4. Streamlined `TeamManagement.tsx` to focus purely on defining reusable Team Formations & Squads with on-page organization switching.
- Separated environment blueprints into `docs/ops/config-templates/.env.dev` and `docs/ops/config-templates/.env.prod`.

---

## Cross-Machine Resume Instructions
1. Start the application in development mode: `./scripts/start.sh` (or for production: `./scripts/start.sh --prod`).
2. First-time production Host Nginx SSL setup and deployment: `./scripts/start.sh --prod --init`.
3. Stop containers: `./scripts/stop.sh` (or `./scripts/stop.sh --volumes` for full wipe).
4. Run doc validation: `python3 scripts/validate_docs.py`.




