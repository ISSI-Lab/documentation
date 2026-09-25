# Shared AI Context Bank: Project Context

This document is loaded by AI coding assistants (Antigravity, Cursor, Copilot) and reviewed by human developers to maintain institutional context across machines.

---

## 1. Project Purpose & Scope
This project provides a multi-service web platform for structured technical document authoring, template design, and collaborative project management. It bridges developer workflows with institutional memory, allowing teams and individual engineers to create, version, and share standardized documentation (ADRs, PRDs, RFCs, Postmortems).

---

## 2. Core Capabilities
- **Template-Driven Markdown Authoring**: Interactive element builders producing standard GitHub-Flavored Markdown.
- **User Authentication & Profiles**: JWT-based session security, password encryption, and user settings.
- **Democratic Team Collaboration**: Any user can create teams and manage members with hierarchical roles (`Owner`, `Manager`, `Member`).
- **Scoped Asset Isolation**: Granular asset management supporting `Public` (guest-discoverable), `Personal` (private), and `Team` scopes.
- **Personal Workspace Hub**: Comprehensive homepage displaying teams, projects, recent documents, and rapid shortcuts.

---

## 3. Technology Stack Overview
- **Orchestration**: Docker Compose (v2+), Docker (v24+)
- **Production Edge**: Host Nginx reverse proxy &rarr; Docker Container Nginx
- **Frontend**: Container Nginx + React 18 / TypeScript / Vite / Tailwind CSS (Port `3939`)
- **Backend**: Node 20 / Express / TypeScript / mysql2 (Port `5000`)
- **Database**: MySQL 8.0 with persistent volume (`mysql_data`, Port `3306`)
- **Shared Network**: Bridge network (`app-net`)
- **Documentation**: Markdown + Mermaid diagrams under `docs/`
- **Automation Scripts**: Cross-platform Python 3.8+ (`scripts/`)

---

## 4. Directory Layout Rules
- All documentation, designs, and team memories must remain inside `docs/`.
- All web application code belongs inside `src/frontend/` or `src/backend/`.
- Never put transient files or application source code directly at the root.

