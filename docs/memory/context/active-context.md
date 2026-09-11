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
- Adopted multi-tier architecture: Host Nginx -> Container Nginx + ReactJS -> NodeJS -> MySQL.
- Exposed developer access port `3000` directly mapped to container Nginx.
- Container Nginx proxies all `/api/` traffic internally to `http://backend:5000/api/`.
- Pre-seeded industry standard templates (ADR, PRD, Incident Postmortem) for immediate use.


