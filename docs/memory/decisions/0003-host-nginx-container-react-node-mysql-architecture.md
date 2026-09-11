# ADR-0003: Multi-Tier Host Nginx -> Container Nginx+ReactJS -> NodeJS -> MySQL Architecture

- **Status**: Accepted
- **Date**: 2026-09-11
- **Deciders**: Engineering Lead, AI Assistant
- **Consulted**: Core Team
- **Informed**: All Developers

---

## Context
The platform requires a modular document management tool enabling users to configure document templates (with custom markdown input fields and other structured elements), author documents dynamically based on those templates, and preview/export compiled markdown.

We needed an architecture that:
1. Operates cleanly in enterprise production where an existing Host Nginx serves as the public ingress/SSL terminator.
2. Eliminates CORS complexity by serving frontend static assets and routing `/api/` traffic through the same origin.
3. Provides developers with immediate, frictionless direct access to the containerized environment on a dedicated port (`http://localhost:3000`).
4. Ensures relational consistency and schema-backed persistence across container restarts for templates and documents.

---

## Decision

We have adopted a 4-tier containerized architecture orchestrated via Docker Compose:

1. **Host Nginx Tier (Production Ingress)**:
   - The host machine runs Nginx on ports 80/443.
   - In production, it reverse-proxies public traffic into `http://127.0.0.1:3000`.
   - Host configuration template provided in [`docs/design/architecture/host-nginx-example.conf`](../../design/architecture/host-nginx-example.conf).

2. **Container Nginx + ReactJS Tier (`web_frontend`)**:
   - Multi-stage Docker build: Node 20 compiles the React 18 TypeScript application; Nginx Alpine serves the static bundle on container port 80.
   - Port 80 is mapped to host port `3000` (`${FRONTEND_PORT:-3000}:80`), allowing developers direct access during development without requiring host Nginx configuration.
   - Container Nginx acts as internal reverse proxy:
     ```nginx
     location /api/ {
         proxy_pass http://backend:5000/api/;
     }
     ```
   - Handles SPA client-side routing via `try_files $uri $uri/ /index.html;`.

3. **NodeJS API Tier (`web_backend`)**:
   - Express + TypeScript service running on internal container port 5000.
   - Implements RESTful APIs for template configuration, document lifecycle, and markdown compilation.
   - Communicates with MySQL using a managed connection pool (`mysql2/promise`).

4. **MySQL Database Tier (`db_mysql`)**:
   - MySQL 8.0 on internal port 3306 backed by persistent named volume `mysql_data`.
   - Initialized with DDL schema and pre-seeded templates via `src/backend/db/init.sql`.

5. **Template-Driven Dynamic Authoring Pattern**:
   - Templates define ordered collections of `document_elements` (markdown fields, short text, select, callouts, code, checklists).
   - The Document Editor dynamically constructs input fields directly from the template schema.
   - The markdown compiler stitches element inputs into standard GitHub-Flavored Markdown.

---

## Consequences

### Positive
- **Zero CORS Issues**: Browser clients communicate only with the container's Nginx on port 3000; all `/api/` calls are proxied server-side.
- **Production Parity**: Dev and prod share the exact same container topology, differing only in whether host Nginx sits in front.
- **Data Durability**: MySQL named volume preserves all created templates and documents across restarts.
- **Extensible Schema**: Document element configuration stored as JSON attributes allows adding new field types without DDL migrations.

### Negative / Trade-offs
- **Container Memory Footprint**: Running MySQL 8.0 and Node.js requires slightly more memory (~300MB) than SQLite or file-backed storage.
- **Multi-Stage Build Time**: Frontend Docker image requires an initial `npm run build` during first container creation.
