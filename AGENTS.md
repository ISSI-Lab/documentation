# Universal AI Assistant Guidelines (`AGENTS.md`)

Welcome to this repository. This project is structured to enable distributed developers and AI agents operating on different machines (macOS, Linux, Windows/WSL, dev containers) to share institutional memory, technical design, and active context seamlessly.

## Repository Layout & Separation of Concerns

```
├── docs/       # Single source of truth for design, memory, requirements, tasks, and runbooks
├── src/        # Multi-service application source code
│   ├── frontend/ # Web client application (Dockerfile, UI code)
│   └── backend/  # API backend service (Dockerfile, endpoints, models)
├── tests/      # Automated integration and end-to-end test suites
└── scripts/    # Cross-platform developer automation and verification tools
```

## AI Agent Directives

### 1. Project Memory & Context
- Before proposing changes or major code implementations, consult the **Context Bank** under [`docs/memory/context/`](docs/memory/context/):
  - [`project-context.md`](docs/memory/context/project-context.md): Project purpose, tech stack, and service boundaries.
  - [`system-patterns.md`](docs/memory/context/system-patterns.md): Reusable architecture patterns and coding conventions.
  - [`active-context.md`](docs/memory/context/active-context.md): Ongoing sprint goals, active branches, and current focus.
- Architectural and technical decisions are permanently logged as ADRs in [`docs/memory/decisions/`](docs/memory/decisions/). Check these before suggesting architectural shifts.

### 2. Technical Design & Contracts
- The contract between frontend and backend services is maintained in [`docs/design/api/`](docs/design/api/). Always ensure frontend and backend code conform to this contract.
- System blueprints and container interaction diagrams are in [`docs/design/architecture/`](docs/design/architecture/). Prefer **Mermaid diagrams** so they render natively across GitHub/GitLab and markdown viewers.

### 3. Cross-Machine & Cross-Platform Rules
- **No Hardcoded Machine Paths**: Never write paths containing machine-specific prefixes like `C:\Users\...`, `/home/username/...`, or `/tmp/...`. Use relative paths or environment variables.
- **POSIX Path Separators**: Always use forward slashes (`/`) in markdown links, Docker configurations, and scripts.
- **Strict File Naming**: Use lowercase kebab-case (`my-feature-name.md`) to prevent case-sensitivity collisions between Windows/macOS and Linux.
- **Keep Local State Local**: Developer notes, local scratchpads, and secrets belong in [`docs/memory/local/`](docs/memory/local/) or `.env` and are strictly gitignored. Never commit local credentials.

### 4. Machine & Shift Handoffs
- When completing a substantial development session or preparing to switch machines, update [`docs/tasks/handoffs/`](docs/tasks/handoffs/) using the handoff template to record:
  - What was completed
  - In-flight work and active branch
  - Test status and known blockers
  - Immediate next steps
