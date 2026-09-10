# Documentation & Multi-Service Project Hub

A production-ready project framework designed to allow distributed developers and AI coding assistants operating on different machines (macOS, Linux, Windows/WSL, dev containers) to share institutional memory, system designs, requirements, and development state without merge conflicts or cross-platform friction.

---

## Architecture Overview

This project uses a **Multi-Service Docker Architecture** with clean separation between application source code and the documentation/memory hub:

```
├── docker-compose.yml       # Multi-service container orchestration
├── .dockerignore            # Excludes docs/ & tests/ from container images
├── .gitattributes           # Cross-platform LF line ending normalization
├── .gitignore               # Ignores local secrets (.env) and private scratchpads
├── AGENTS.md                # Universal instructions for AI coding assistants
├── GEMINI.md                # Antigravity/Gemini workspace configuration
├── README.md                # This project guide
│
├── src/                     # Multi-Service Application Code
│   ├── frontend/            # Frontend Web App (Dockerfile, package.json, UI components)
│   └── backend/             # Backend API Service (Dockerfile, requirements.txt, endpoints)
│
├── docs/                    # Unified Design & Memory Workspace
│   ├── requirements/        # PRDs, user stories, and product roadmap
│   ├── design/              # System architecture, RFCs, API contracts, data models, diagrams
│   ├── memory/              # ADRs (decisions), shared context bank, glossary, runbooks
│   ├── tasks/               # Active workstreams, backlog, and machine handoffs
│   ├── qa/                  # Test plans, cross-platform matrices, release checklists
│   ├── ops/                 # Environments, config templates (.env.example), CI/CD
│   └── templates/           # Scaffolding templates for ADRs, RFCs, PRDs, and Handoffs
│
├── tests/                   # Cross-service E2E and integration test suites
└── scripts/                 # Cross-platform developer automation & validation tools
```

---

## Quick Start: Running with Docker

Regardless of whether you are running on macOS, Ubuntu/Debian, or Windows with WSL2, you can spin up the full stack with a single command:

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (version 24+)
- [Docker Compose](https://docs.docker.com/compose/) (v2+)
- Python 3.8+ (for helper scripts, optional)

### 2. Configure Environment
Copy the configuration template:
```bash
cp docs/ops/config-templates/.env.example .env
```

### 3. Launch Services
```bash
# Build and start all services in the background
docker compose up --build -d

# View live streaming logs
docker compose logs -f
```

- **Frontend Website**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)

### 4. Stop Services
```bash
docker compose down
```

---

## How Development is Shared Across Machines

| Development Facet | Location | Sync & Sharing Mechanism |
| :--- | :--- | :--- |
| **Requirements & Scope** | [`docs/requirements/`](docs/requirements/) | Numbered PRDs (`0001-...`) version-controlled via Git |
| **System Design & RFCs** | [`docs/design/`](docs/design/) | Modulized specs and Mermaid diagrams (`.mmd`) rendering natively on GitHub |
| **API Contracts** | [`docs/design/api/`](docs/design/api/) | Shared interface contract between frontend and backend developers |
| **Architectural Decisions** | [`docs/memory/decisions/`](docs/memory/decisions/) | Numbered, immutable ADRs (e.g. `0001-record-architecture-decisions.md`) |
| **AI Agent Context Bank** | [`docs/memory/context/`](docs/memory/context/) | Shared context files read by AI agents on any machine (`active-context.md`) |
| **Machine & Shift Handoffs** | [`docs/tasks/handoffs/`](docs/tasks/handoffs/) | Shift logs (`YYYY-MM-DD-developer.md`) ensuring in-flight work is never lost |
| **Private Scratchpads** | [`docs/memory/local/`](docs/memory/local/) | Gitignored local directory for developer-only notes and drafts |
| **Secrets & Keys** | `.env` (from `.env.example`) | Gitignored local file; team commits sanitized blueprint in `docs/ops/` |

---

## Developer Workflows & Scaffolding CLI

We provide cross-platform Python CLI tools under `scripts/` that run on Windows, macOS, and Linux:

### 1. Create a New Record
Automatically assigns the next sequential number and applies the correct template:

```bash
# Create an Architecture Decision Record
python3 scripts/new_record.py adr "use-postgresql"

# Create a Request for Comments (Design Proposal)
python3 scripts/new_record.py rfc "caching-strategy"

# Create a Product Requirement Document
python3 scripts/new_record.py prd "user-onboarding"

# Create a Shift / Machine Handoff before switching machines
python3 scripts/new_record.py handoff "session-wrapup"
```

### 2. Validate Documentation & Links
Verify all internal relative links, kebab-case file naming, and LF line endings before pushing to Git:

```bash
python3 scripts/validate_docs.py
```

---

## AI Assistant & Agent Guidelines

If you or your team members use AI coding assistants (such as Antigravity, Gemini, Cursor, Copilot, or Claude Code), review [`AGENTS.md`](AGENTS.md) and [`GEMINI.md`](GEMINI.md). They instruct AI tools to:
1. Always read [`docs/memory/context/`](docs/memory/context/) for architectural context and coding patterns.
2. Respect API contracts in [`docs/design/api/`](docs/design/api/) when writing frontend or backend code.
3. Keep all documentation in `docs/` and all application code in `src/`.
