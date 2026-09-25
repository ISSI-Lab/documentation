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
| Frontend Service | AI Agent | Completed | Personal Homepage, Public Template Pool, Document Dashboard, Auth Modal, Account Modal, Team Management |
| Host & Container Proxy | AI Agent | Completed | Container Nginx port `3939`, reverse proxy `/api/`, production Host Nginx guide |

---

## Recent Significant Decisions
- Adopted multi-tier architecture: Host Nginx -> Container Nginx + ReactJS -> NodeJS -> MySQL ([ADR-0003](../decisions/0003-host-nginx-container-react-node-mysql-architecture.md)).
- Implemented user authentication, open team creation with Owner/Manager/Member roles, scoped asset visibility, and personal homepage dashboard ([ADR-0004](../decisions/0004-user-authentication-and-hierarchical-team-collaboration.md)).
- Exposed developer access port `3939` directly mapped to container Nginx.
- Container Nginx proxies all `/api/` traffic internally to `http://backend:5000/api/`.
- Unauthenticated visitors land directly on the **Public Document Template Pool** to explore blueprints and preview document structures before registering.
- Logged-in users land on a **Personal Homepage** displaying their Teams, associated Projects, recent documents, and quick actions.
- Enabled team creation for **all users** without Organizer restriction; creators are designated as **Team Owner** with authority to assign **Team Managers** and **Team Members**.

---

## Cross-Machine Resume Instructions
When switching to or resuming on another workstation / IDE (macOS, Linux, Windows/WSL2):
1. Review the latest session handoff: [`docs/tasks/handoffs/2026-09-25-auth-teams-homepage-and-ui-layout-overhaul.md`](../../tasks/handoffs/2026-09-25-auth-teams-homepage-and-ui-layout-overhaul.md).
2. Review the cross-machine setup guide: [`docs/tasks/handoffs/2026-09-11-cross-machine-development-guide.md`](../../tasks/handoffs/2026-09-11-cross-machine-development-guide.md).
3. Start the full stack: `docker compose up --build -d`.
4. Access the application directly at `http://localhost:3939`.
5. Run doc validation: `python3 scripts/validate_docs.py`.




