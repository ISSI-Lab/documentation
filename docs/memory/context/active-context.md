# Shared AI Context Bank: Active Workstreams & Sprint State

This file tracks the current sprint state, active workstreams, and recent changes so any developer or AI assistant starting a new session immediately understands what is in progress.

---

## Current Sprint Focus
- **Goal**: Complete document templating, element configuration, item hierarchy levels, and repeatable dynamic items with "+" button on Nginx + ReactJS -> NodeJS -> MySQL.
- **Active Branch**: `main`

---

## Active Workstreams
| Workstream | Owner | Status | Current Focus |
| :--- | :--- | :--- | :--- |
| Project Scaffolding | Team | Completed | Root layout, docs hub, Docker Compose orchestration |
| MySQL Database | AI Agent | Completed | Schema DDL (`init.sql`), persistent volume, seed templates with levels |
| Backend Service | AI Agent | Completed | Node 20 / Express API, MySQL pool, Markdown compilation with heading depths |
| Frontend Service | AI Agent | Completed | Template builder with levels/indent, Document editor with "+" repeatable item button |
| Host Nginx Config | AI Agent | Completed | Production reverse proxy guide (`host-nginx-example.conf`) |


---

## Recent Significant Decisions
- Adopted multi-tier architecture: Host Nginx -> Container Nginx + ReactJS -> NodeJS -> MySQL ([ADR-0003](../decisions/0003-host-nginx-container-react-node-mysql-architecture.md)).
- Exposed developer access port `3000` directly mapped to container Nginx.
- Container Nginx proxies all `/api/` traffic internally to `http://backend:5000/api/`.
- Pre-seeded industry standard templates (ADR, PRD, Incident Postmortem) for immediate use.
- Implemented document item levels (L1, L2, L3) and special repeatable list items with "+" buttons ([RFC-0002](../../design/rfcs/0002-document-templating-and-authoring-engine.md)).

---

## Cross-Machine Resume Instructions
When switching to or resuming on another workstation (macOS, Linux, Windows/WSL2):
1. Review the master guide: [`docs/tasks/handoffs/2026-09-11-cross-machine-development-guide.md`](../../tasks/handoffs/2026-09-11-cross-machine-development-guide.md).
2. Start the full stack: `docker compose up --build -d`.
3. Access the application directly at `http://localhost:3000`.



