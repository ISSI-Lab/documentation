# Shared AI Context Bank: System Patterns & Conventions

This document specifies reusable engineering patterns and code standards across the frontend and backend services.

---

## 1. Architectural Patterns
- **Multi-Tier Edge & Proxy Architecture**:
  - In production: **Host Nginx** (`:80`/`:443`) &rarr; **Container Nginx** (`:80`, exposed as `:3939`) &rarr; **NodeJS Express** (`:5000`) &rarr; **MySQL** (`:3306`).
  - In development: Developers directly access `http://localhost:3939` (or custom allocated port).
  - Host Nginx handles SSL termination (`/etc/letsencrypt/`) and Let's Encrypt webroot verification (`/var/www/certbot`), proxying to container frontend port `127.0.0.1:3939`.
  - Container Nginx serves React SPA static assets and proxies `/api/` traffic internally to `http://backend:5000/api/`, eliminating cross-origin (CORS) friction.
- **Dynamic Port Collision Auto-Resolution Pattern**:
  - In development, if a port is occupied by host services (e.g. macOS AirPlay on `5000` or local MySQL on `53306`), it automatically allocates the next available port and updates `.env`. In production (`--prod`), ports are locked to prevent breaking reverse proxy routing. Project containers are recognized to prevent false self-collisions.
- **Environment Blueprint Separation Pattern**:
  - Development defaults are maintained in `docs/ops/config-templates/.env.dev` (`NODE_ENV=development`, phpMyAdmin enabled by default).
  - Production defaults are maintained in `docs/ops/config-templates/.env.prod` (`NODE_ENV=production`, phpMyAdmin disabled by default, Certbot webroot defined).
- **Template-Driven Dynamic Authoring Pattern**:
  - Document templates define ordered schemas of `document_elements` (pure markdown text fields for viewing, interactive fields with description and input parts, iterative arrays of editable elements with description-value pairs, rich markdown editors, short text, select, callouts, code, checklists).
  - The document editor dynamically instantiates input fields, view-only specification blocks, and formatting tools directly from the template schema.
  - The markdown compiler (`src/backend/src/compiler.ts`) stitches discrete elements deterministically into GitHub-Flavored Markdown.
- **Self-Healing Database Pattern**:
  - The backend verifies database tables on startup and automatically seeds industry-standard templates (ADR, PRD, Postmortem) if empty.
  - Uses connection pooling (`mysql2/promise`) with retry logic to ensure smooth startup behind Docker healthchecks.
- **Authentication & RBAC Security Pattern**:
  - Stateless JWT tokens passed in `Authorization: Bearer <token>` headers.
  - Password hashing with `bcryptjs` (salt rounds = 10).
  - Express route middleware (`authenticateUser`, `optionalAuth`) inspects tokens and attaches user context.
- **Democratic Organization & Project Collaboration Pattern**:
  - Any authenticated user can create an organization and automatically assumes the `owner` role.
  - Role hierarchy: `owner` (full administration, ownership transfer, deletion) &gt; `manager` (member invitations, role modifications, project creation) &gt; `member` (view projects, create/edit documents).
  - Scoped visibility: `public` (accessible to all, including unauthenticated guests), `personal` (isolated to individual author), and `organization` (restricted to organization roster).
- **Organization Team Formations (Assignment Sets) & Team Staffing Pattern**:
  - The sequence and containment flow begins with **Team Formations** (`team_assignment_sets`), created first within an organization to define how individual teams are formed and staffed.
  - Within each Team Formation, functional squads are created (`organization_teams.set_id`).
  - Each squad contains users from within the organization (`organization_team_members`) with designated roles (`lead`, `member`).
  - **Projects** associate with a Team Formation (`projects.team_assignment_set_id`), so different projects in the same organization can associate with different formations, reuse formations, or clone a formation for dedicated project customization (`clone-set`).
  - **User-Facing Labeling**: The UI standardizes on "Team Formation" / "Formation" (e.g. "Clone Formation", "Teams within this formation", "Create Team Formation") while retaining backwards-compatible API and DB keys.
  - Backward compatibility: `/api/v1/teams` legacy route alias is preserved for legacy API clients and scripts.
- **Strict Team vs. Individual Project Association Pattern (No Hybrid)**:
  - Projects support two strictly mutually exclusive association models: **Team Association** (via squads and reusable formations) or **Individual Association** (via direct individual organization users). Hybrid staffing is explicitly forbidden.
  - Dictated by `projects.association_type` (`team` or `individual`).
  - Switching modes executes atomic backend transactions that delete the inactive configuration (`team_assignment_set_id` and `project_team_assignments` purged on switch to individual; `project_individual_members` purged on switch to team).
  - Frontend surfaces a segmented toggle in `ProjectTeamAssignmentModal` with confirmation modals before mode transitions, and dedicated individual member roster management.
- **Document Submissions & Creator Review Pattern**:
  - **Document Types**: Documents can be created as either a **Personal Document** (individual ownership) or a **Project Shared Document** (collaborative shared editing).
  - **Submittable Deliverables**: Both document types can be configured as submittable (`is_submittable: boolean`).
  - **Independent Copy Isolation for Personal and Team Submittable Documents**:
    - Master submittable documents (`is_submittable: true` and `copied_from_id IS NULL`) are published specifications. Non-creators are strictly forbidden from mutating master documents in-place (`PUT /api/v1/documents/:id` returns `403 Forbidden`).
    - **Personal Submittable Documents**: Opening/editing a personal submittable doc provisions or opens an individual copy (`copied_from_id = masterDoc.id`, `created_by = participant.id`) via `POST /api/v1/documents/:id/copy`. Edits mutate only this copy, synced into `document_submissions` for the user.
    - **Team Shared Submittable Documents**: Each team assigned to the project maintains their own copy (`copied_from_id = masterDoc.id`, `assigned_team_id = team.id`). Whoever in the team first opens the document creates the copy for the team via `POST /api/v1/documents/:id/copy`. Subsequent team members opening the document receive that same copy to share editing within the team. Different teams have distinct instances, ensuring full isolation between teams.
    - Edits made on personal or team document copies automatically synchronize with `document_submissions` (`submission_type = 'personal'` or `'team'`) for creator review.
  - **Personal Document Submissions**: When a personal document is submittable, each individual participant has an isolated submission (`document_submissions.submission_type = 'personal'`). The review roster tracks every individual's submission status (`not_started`, `draft`, `submitted`, `reviewed`).
  - **Project Shared Document Submissions**: When a project shared document is submittable, submissions are strictly **according to team** (`document_submissions.submission_type = 'team'`). Members of the assigned team collaborate on a shared draft and submit on behalf of the team.
  - **Prompt Pre-Population Strategy**: When a participant or team accesses their submission (`GET /api/v1/documents/:id/my-submission`), the draft is auto-initialized and pre-populated with the creator's prompt and element defaults rather than starting blank.
  - **Creator Review & Bidirectional Feedback**: Project creators and organization managers can inspect all submissions, update review statuses (`reviewed`, request revisions via `draft`, `submitted`), and exchange timestamped feedback comments (`submission_comments`) with participants.
- **Document Elements & Grouped Iterations Architecture**:
  - **Pure Markdown View-Only Elements**:
    - `view_markdown` property on any element and dedicated `pure_markdown` element type render formatted markdown strictly for viewing without editing inputs.
  - **Grouped Iteration Elements (`iteration_group`)**:
    - Mechanism to group a list of fixed key-value items per iteration cycle (e.g. Iteration #1, #2, ... #N with fixed keys `Reason`, `Todo`, `Response`).
    - The template creator defines the list of fixed keys via `iteration_fields` (`IterationFieldConfig[]`).
    - Fixed keys are non-editable labels/badges for the document writer, who only fills in the values for each key and dynamically adds or removes entire iteration cycles.
    - Markdown compiler renders each cycle under subheadings (`### Iteration #{N}`) with itemized list entries (`- **{Key}:** {Value}`).
  - **Iterative Arrays & Repeatable Lists**:
    - Legacy dynamic lists (`interactive_list` / `repeatable_list`) allow adding dynamic single items (description - value pairs) via `+` buttons.

---

## 2. Frontend & UI Layout Conventions
- **Dual-State Landing**:
  - Unauthenticated visitors land on the **Public Template Pool** to inspect and preview document blueprints.
  - Authenticated users land on the **Personal Homepage** displaying organization memberships, project links, recent documents, and quick-action shortcuts.
- **Unified Navigation**: Top navigation bar with tab routing (`Home`, `Documents`, `Templates`, `Organization Management`) and profile account menu.
- **Scoped Filtering**: Document and Template catalogs feature tabbed category filters (`Recent` / `Public`, `Personal`, `Organization Templates` / `Organization Documents`) with inline organization selection dropdowns and real-time search.

---

## 3. Docker & Container Patterns
- **Multi-Stage Frontend Build**: Stage 1 uses Node 20 to compile the React TypeScript SPA; Stage 2 uses Nginx Alpine to serve static assets and handle reverse proxying.
- **Layer Caching**: Always copy `package*.json` and run `npm install` *before* copying application source code in `Dockerfile`s.
- **Volume Persistence**: MySQL data persists in Docker named volume `mysql_data`.
- **Environment Parity**: Host ports are parameterized via environment variables (`FRONTEND_PORT`, `BACKEND_PORT`, `MYSQL_PORT`, `PMA_PORT`).
- **Profile-Gated Administration (phpMyAdmin)**: phpMyAdmin runs under Docker Compose profiles (`profiles: ["phpmyadmin", "pma"]`), active by default in dev, and disabled in prod unless explicitly triggered via `-pma`.
