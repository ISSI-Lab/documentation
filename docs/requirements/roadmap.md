# Product & Engineering Roadmap

This roadmap tracks high-level delivery milestones across releases.

---

## Phase 1: Foundation & Cross-Platform Scaffolding (Current)
- [x] Standardized folder structure separating `docs/` and `src/`.
- [x] Multi-service Docker configuration (`docker-compose.yml`, `Dockerfile`s).
- [x] Cross-platform git hygiene (`.gitattributes`, `.gitignore`, `.dockerignore`).
- [x] Cross-platform scaffolding CLI (`scripts/new_record.py`).
- [x] Documentation integrity validator (`scripts/validate_docs.py`).

## Phase 2: Core Application Implementation
- [ ] Implement backend API skeleton in `src/backend/` (FastAPI / health endpoints).
- [ ] Implement frontend web skeleton in `src/frontend/` (Vite + React or Next.js).
- [ ] Connect frontend to backend via shared API contract (`docs/design/api/`).
- [ ] Add basic integration test suite in `tests/integration/`.

## Phase 3: CI/CD & Automated Quality Gates
- [ ] Add GitHub Actions / GitLab CI pipeline for automated linting and tests.
- [ ] Add automated PR check for documentation link validation via `scripts/validate_docs.py`.
- [ ] Build multi-arch Docker images (`amd64` and `arm64` for Apple Silicon).
