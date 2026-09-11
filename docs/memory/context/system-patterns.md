# Shared AI Context Bank: System Patterns & Conventions

This document specifies reusable engineering patterns and code standards across the frontend and backend services.

---

## 1. Architectural Patterns
- **Multi-Tier Edge & Proxy Architecture**:
  - In production: **Host Nginx** (`:80`/`:443`) &rarr; **Container Nginx** (`:80`, exposed as `:3000`) &rarr; **NodeJS Express** (`:5000`) &rarr; **MySQL** (`:3306`).
  - In development: Developers directly access `http://localhost:3000`.
  - Container Nginx serves React SPA static assets and proxies `/api/` traffic internally to `http://backend:5000/api/`, eliminating cross-origin (CORS) friction.
- **Template-Driven Dynamic Authoring Pattern**:
  - Document templates define ordered schemas of `document_elements` (markdown fields, short text, select, callouts, code, checklists).
  - The document editor dynamically instantiates input fields and formatting tools directly from the template schema.
  - The markdown compiler (`src/backend/src/compiler.ts`) stitches discrete elements deterministically into GitHub-Flavored Markdown.
- **Self-Healing Database Pattern**:
  - The backend verifies database tables on startup and automatically seeds industry-standard templates (ADR, PRD, Postmortem) if empty.
  - Uses connection pooling (`mysql2/promise`) with retry logic to ensure smooth startup behind Docker healthchecks.

---

## 2. Docker & Container Patterns
- **Multi-Stage Frontend Build**: Stage 1 uses Node 20 to compile the React TypeScript SPA; Stage 2 uses Nginx Alpine to serve static assets and handle reverse proxying.
- **Layer Caching**: Always copy `package*.json` and run `npm install` *before* copying application source code in `Dockerfile`s.
- **Volume Persistence**: MySQL data persists in Docker named volume `mysql_data`.
- **Environment Parity**: Host ports are parameterized via environment variables (`FRONTEND_PORT`, `BACKEND_PORT`, `MYSQL_PORT`).

