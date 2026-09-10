# ADR-0002: Multi-Service Docker Architecture with Clean Docs Hub

- **Status**: Accepted
- **Date**: 2026-09-10
- **Deciders**: Core Engineering Team

---

## Context
We need to build a web application that includes frontend and backend components while keeping the repository organized, clean, and portable across macOS, Linux, and Windows/WSL machines.
Placing lifecycle documentation at the root mixes documentation and application code. Furthermore, developers on different machines have different local runtimes (Node versions, Python versions), which often leads to "works on my machine" bugs.

## Decision
1. We will adopt a **Multi-Service Architecture**:
   - `src/frontend/`: Client application with its own Dockerfile and dependencies.
   - `src/backend/`: API server with its own Dockerfile and dependencies.
2. We will use **Docker Compose** (`docker-compose.yml`) at the project root for local development orchestration, mounting source directories for live code hot-reload.
3. We will isolate all documentation, design specifications, requirements, tasks, and memory into a dedicated **`docs/`** directory.
4. We will use `.dockerignore` to exclude `docs/`, `.agents/`, and tests from Docker build contexts to ensure small, fast, and secure container images.

## Consequences
### Positive
- Developers only need Docker installed; no host runtime mismatches.
- Root directory remains clean and uncluttered.
- Documentation, memory, and design are preserved without polluting container images or code reviews.

### Negative
- Developers must have Docker installed and running locally.
