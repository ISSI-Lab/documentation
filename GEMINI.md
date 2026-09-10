# Antigravity Workspace Configuration (`GEMINI.md`)

This workspace uses the Antigravity Customization System to maintain project memory and design consistency across developers and machines.

## Memory & Documentation Hub
- Memory bank: [`docs/memory/context/`](docs/memory/context/)
- Architecture & Design: [`docs/design/`](docs/design/)
- Multi-Service Application Code: [`src/`](src/)
  - Frontend: [`src/frontend/`](src/frontend/)
  - Backend: [`src/backend/`](src/backend/)
- ADR Registry: [`docs/memory/decisions/`](docs/memory/decisions/)
- Machine Handoffs: [`docs/tasks/handoffs/`](docs/tasks/handoffs/)

## Core Workspace Guidelines
1. **Separation of Concerns**: Never place loose documentation or memory files at root or inside `src/`. All documentation, design, requirements, and decisions belong under `docs/`.
2. **Cross-Platform Compatibility**: Always use relative paths with forward slashes (`/`), normalize line endings (LF), and name files using kebab-case.
3. **Docker Readiness**: Keep container images lightweight by excluding `docs/` and test suites via `.dockerignore`.
4. **Scaffolding Automation**: Use `python3 scripts/new_record.py` to create numbered ADRs, RFCs, PRDs, and Handoffs.
