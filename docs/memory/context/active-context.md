# Shared AI Context Bank: Active Workstreams & Sprint State

This file tracks the current sprint state, active workstreams, and recent changes so any developer or AI assistant starting a new session immediately understands what is in progress.

---

## Current Sprint Focus
- **Goal**: Initializing cross-platform multi-service scaffolding and documentation workspace.
- **Active Branch**: `main`

---

## Active Workstreams
| Workstream | Owner | Status | Current Focus |
| :--- | :--- | :--- | :--- |
| Project Scaffolding | Team | Completed | Root layout, docs hub, Docker Compose orchestration |
| Backend Skeleton | TBD | Pending | Implement initial FastAPI health routes in `src/backend` |
| Frontend Skeleton | TBD | Pending | Implement initial Vite/React web client in `src/frontend` |

---

## Recent Significant Decisions
- Adopted multi-service Option B with Docker Compose orchestration ([ADR-0002](../decisions/0002-multi-service-docker-architecture.md)).
- Enforced all project memory and design inside `docs/` to keep root and code clean.
