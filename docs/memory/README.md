# Project & Institutional Memory Hub

This directory serves as the persistent memory bank of the project. It stores knowledge, architectural decisions, setup guides, and shared AI context that remains accessible to all developers and AI assistants regardless of which machine they are working on.

---

## Directory Structure

- **[`decisions/`](decisions/)**: Architecture Decision Records (ADRs). Immutable logs of technical choices and their trade-offs.
  - [`0001-record-architecture-decisions.md`](decisions/0001-record-architecture-decisions.md)
  - [`0002-multi-service-docker-architecture.md`](decisions/0002-multi-service-docker-architecture.md)
- **[`context/`](context/)**: Shared context bank consumed by AI pair programmers (Antigravity, Cursor, Copilot).
  - [`project-context.md`](context/project-context.md): Product vision, tech stack, and service boundaries.
  - [`system-patterns.md`](context/system-patterns.md): Coding idioms, patterns, and design principles.
  - [`active-context.md`](context/active-context.md): Current active sprint state and immediate milestones.
- **[`knowledge/`](knowledge/)**: Ubiquitous domain terminology and organizational learning.
  - [`glossary.md`](knowledge/glossary.md): Project terms and definitions.
  - [`lessons-learned.md`](knowledge/lessons-learned.md): Incident postmortems and retrospective notes.
- **[`runbooks/`](runbooks/)**: Step-by-step developer guides.
  - [`cross-platform-setup.md`](runbooks/cross-platform-setup.md): Environment setup across macOS, Linux, and Windows/WSL.
  - [`docker-workflows.md`](runbooks/docker-workflows.md): Docker commands, container debugging, and volume management.
- **[`local/`](local/)**: Private, gitignored developer scratchpad for machine-specific notes.
