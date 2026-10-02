# Shared AI Context Bank: Active Workstreams & Sprint State

This file tracks the current sprint state, active workstreams, and recent changes so any developer or AI assistant starting a new session immediately understands what is in progress.

---

## Current Sprint Focus
- **Goal**: Full-stack User Authentication, Democratic Team & Project Collaboration, Guest-accessible Public Template Pool, Personal Homepage Dashboard, and Scoped Document Authoring.
- **Active Branch**: `main`

---

## Active Workstreams
| Workstream | Owner | Status | Current Focus |
| :--- | :--- | :--- | :--- |
| Project Scaffolding | Team | Completed | Root layout, docs hub, Docker Compose orchestration |
| MySQL Database | AI Agent | Completed | Schema DDL (`init.sql`), persistent volume, user auth, teams, projects, templates, and documents tables |
| Backend Service | AI Agent | Completed | Node 20 / Express API, JWT auth, bcrypt hashing, team/project RBAC, template & document CRUD |
| Frontend Service | AI Agent | Completed | Personal Homepage, Public Template Pool, Document Dashboard, Auth Modal, Account Modal, Organization Management |
| Host & Container Proxy | AI Agent | Completed | Container Nginx port `3939`, reverse proxy `/api/`, production Host Nginx guide |
| Email Service & Registration | AI Agent | Completed | AES-256-GCM `email_config.json`, default `EMAIL_CONFIG_SECRET`, CLI wizard (`scripts/setup_email.sh`), Docker integration in `scripts/start.sh`, verification email dispatch |
| Organization Domain Refactoring | AI Agent | Completed | Elevated teams to top-level organizations across DB schemas, backend APIs, frontend UI, and tests to prepare for future nested sub-teams ([ADR-0005](../decisions/0005-refactor-team-domain-to-organization.md)) |

---

## Recent Significant Decisions
- Adopted multi-tier architecture: Host Nginx -> Container Nginx + ReactJS -> NodeJS -> MySQL ([ADR-0003](../decisions/0003-host-nginx-container-react-node-mysql-architecture.md)).
- Implemented user authentication, open team creation with Owner/Manager/Member roles, scoped asset visibility, and personal homepage dashboard ([ADR-0004](../decisions/0004-user-authentication-and-hierarchical-team-collaboration.md)).
- Refactored top-level collaborative tenant from Team to Organization to facilitate nested sub-teams in future phases ([ADR-0005](../decisions/0005-refactor-team-domain-to-organization.md)).
- Implemented user registration account verification token flow with strict 30-second token expiration and resend capabilities.
- Added encrypted email configuration file (`src/backend/config/email_config.json`) with `smtp.appunity.net` defaults, managed via `scripts/setup_email.sh` / `scripts/manage_email_config.py`, auto-loaded by `scripts/start.sh`, and documented in [`docs/memory/runbooks/email-configuration-guide.md`](../runbooks/email-configuration-guide.md).
- Consolidated startup and deployment automation into `scripts/start.sh` (defaulting to development with phpMyAdmin on port `28080`, and `--prod` for production).
- Implemented automatic host port collision detection and auto-reallocation in `scripts/start.sh` to prevent `port is already allocated` errors across different developer machines.
- Automated Host Nginx site configuration (`/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/`), Certbot SSL bootstrapping/issuance, and Host Nginx restarting in `scripts/start.sh --prod --init`.
- Separated environment blueprints into `docs/ops/config-templates/.env.dev` and `docs/ops/config-templates/.env.prod`.

---

## Cross-Machine Resume Instructions
1. Start the application in development mode: `./scripts/start.sh` (or for production: `./scripts/start.sh --prod`).
2. First-time production Host Nginx SSL setup and deployment: `./scripts/start.sh --prod --init`.
3. Stop containers: `./scripts/stop.sh` (or `./scripts/stop.sh --volumes` for full wipe).
4. Run doc validation: `python3 scripts/validate_docs.py`.




