# Documentation & Shared Memory Hub

Welcome to the central documentation, design, and memory hub for this project.

This directory is organized into distinct lifecycle stages to enable developers on different machines (and AI coding assistants) to collaborate asynchronously without losing context or encountering merge conflicts.

---

## Directory Navigation

```
docs/
├── requirements/      # 1. Product Requirements, PRDs, and User Stories
├── design/            # 2. Architecture Blueprints, RFCs, APIs, and Data Models
├── memory/            # 3. Institutional Knowledge, ADRs, and Shared AI Context
├── tasks/             # 4. Active Workstreams, Backlog, and Machine Handoffs
├── qa/                # 5. Test Plans, Verification Matrices, and Release Checklists
├── ops/               # 6. Deployment Specs, Environment Blueprints (.env.example), CI/CD
└── templates/         # 7. Reusable Document Templates for New Proposals and Records
```

### 1. [Requirements](requirements/)
Defines *what* we are building and *why*.
- [`prds/`](requirements/prds/): Formal Product Requirement Documents with scope, goals, and acceptance criteria.
- [`user-stories/`](requirements/user-stories/): Persona-driven stories and workflows.
- [`roadmap.md`](requirements/roadmap.md): Milestone timeline.

### 2. [Design](design/)
Defines *how* the system is designed.
- [`architecture/`](design/architecture/): Multi-service topologies, container interactions, and C4 component models.
- [`rfcs/`](design/rfcs/): Request for Comments for major architectural changes.
- [`api/`](design/api/): Shared API contracts between the frontend and backend services.
- [`data-models/`](design/data-models/): Database schemas, ERDs, and event specifications.
- [`ui-ux/`](design/ui-ux/): User interface wireframes and design tokens.
- [`diagrams/`](design/diagrams/): Version-controlled Mermaid diagram source files.

### 3. [Memory](memory/)
Defines *what was decided, learned, and configured*.
- [`decisions/`](memory/decisions/): Numbered Architecture Decision Records (ADRs).
- [`context/`](memory/context/): Shared context bank (`project-context.md`, `system-patterns.md`, `active-context.md`) read by developers and AI agents across machines.
- [`knowledge/`](memory/knowledge/): Ubiquitous domain glossary and lessons learned / postmortems.
- [`runbooks/`](memory/runbooks/): Machine setup guides (macOS, Linux, Windows) and Docker workflows.
- [`local/`](memory/local/): Gitignored local scratchpads for private developer notes.

### 4. [Tasks](tasks/)
Defines *what is happening right now*.
- [`active/`](tasks/active/): Current sprint priorities and branch status.
- [`backlog/`](tasks/backlog/): Prioritized feature ideas and technical debt.
- [`handoffs/`](tasks/handoffs/): Machine/developer handoff logs capturing in-flight work before switching machines.

### 5. [QA](qa/)
Defines *how we verify quality*.
- [`test-plans/`](qa/test-plans/): Integration, E2E, and component testing strategies.
- [`test-matrices/`](qa/test-matrices/): Cross-platform, OS, and browser test matrices.
- [`manual-checklists/`](qa/manual-checklists/): Staging and pre-release smoke test checklists.

### 6. [Ops](ops/)
Defines *how the system runs and deploys*.
- [`environments/`](ops/environments/): Development, staging, and production environment specs.
- [`config-templates/`](ops/config-templates/): `.env.example` blueprint and configuration schema.
- [`ci-cd/`](ops/ci-cd/): Continuous integration and deployment runbooks.

### 7. [Templates](templates/)
Standardized markdown templates used by `scripts/new_record.py` for creating new ADRs, RFCs, PRDs, and Handoffs.
