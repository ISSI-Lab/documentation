# Shared AI Context Bank: Active Workstreams & Sprint State

This file tracks the current sprint state, active workstreams, and recent changes so any developer or AI assistant starting a new session immediately understands what is in progress.

---

## Current Sprint Focus
- **Goal**: Implement Public Document Template Pool for unauthenticated users, Personal Homepage showing teams & projects upon login, and open Team Creation with Owner / Manager / Member role assignment.
- **Active Branch**: `main`

---

## Active Workstreams
| Workstream | Owner | Status | Current Focus |
| :--- | :--- | :--- | :--- |
| Project Scaffolding | Team | Completed | Root layout, docs hub, Docker Compose orchestration |
| MySQL Database | AI Agent | Completed | Schema DDL (`init.sql`), persistent volume, seed templates with public visibility, owner role support |
| Backend Service | AI Agent | Completed | Node 20 / Express API, MySQL pool, open team creation for all users, role permissions |
| Frontend Service | AI Agent | Completed | Public Template Pool view, Personal Homepage (Teams & Projects), Team Owner & Manager management |
| Host Nginx Config | AI Agent | Completed | Production reverse proxy guide (`host-nginx-example.conf`) |

---

## Recent Significant Decisions
- Adopted multi-tier architecture: Host Nginx -> Container Nginx + ReactJS -> NodeJS -> MySQL ([ADR-0003](../decisions/0003-host-nginx-container-react-node-mysql-architecture.md)).
- Exposed developer access port `3000` directly mapped to container Nginx.
- Container Nginx proxies all `/api/` traffic internally to `http://backend:5000/api/`.
- Unauthenticated visitors land directly on the **Public Document Template Pool** to explore blueprints and preview document structures before registering.
- Logged-in users land on a **Personal Homepage** displaying their Teams, associated Projects, recent documents, and quick actions.
- Enabled team creation for **all users** without Organizer restriction; creators are designated as **Team Owner** with authority to assign **Team Managers** and **Team Members**.

---

## Cross-Machine Resume Instructions
When switching to or resuming on another workstation (macOS, Linux, Windows/WSL2):
1. Review the master guide: [`docs/tasks/handoffs/2026-09-11-cross-machine-development-guide.md`](../../tasks/handoffs/2026-09-11-cross-machine-development-guide.md).
2. Start the full stack: `docker compose up --build -d`.
3. Access the application directly at `http://localhost:3000`.



