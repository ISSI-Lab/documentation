# User Stories & Acceptance Criteria

This directory contains functional user stories grouped by epic.

## Epic 1: Developer Experience & Multi-Machine Sync
- **Story US-01**: As a developer switching from my office Linux desktop to my MacBook laptop, I want to pull the latest git branch and read a shift handoff log so that I know immediately what tasks are pending and what needs testing.
  - *Acceptance Criteria*: Running `python3 scripts/new_record.py handoff` scaffolds a standardized log in `docs/tasks/handoffs/`.
- **Story US-02**: As a developer on Windows, I want files committed on Linux to have correct line endings so that git diffs only reflect actual code changes.
  - *Acceptance Criteria*: Root `.gitattributes` normalizes all text to `LF`.

## Epic 2: Multi-Service Docker Execution
- **Story US-03**: As a frontend developer, I want to launch the backend API locally via Docker without manually installing Python dependencies on my host machine.
  - *Acceptance Criteria*: Running `docker compose up` starts both frontend (`:3000`) and backend (`:8000`) services.
- **Story US-04**: As a backend developer, I want changes made to `src/backend` to hot-reload inside the container immediately.
  - *Acceptance Criteria*: `docker-compose.yml` mounts `./src/backend:/app` with hot-reloading enabled.
