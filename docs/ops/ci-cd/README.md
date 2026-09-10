# CI / CD Pipelines & Automation

This directory documents the continuous integration and delivery architecture.

---

## 1. Automated CI Checks
On every pull request, the CI pipeline should execute:
1. **Documentation Link Check**: `python3 scripts/validate_docs.py`
2. **Linting & Formatting**: Frontend (ESLint/Prettier) and Backend (Ruff/Flake8/Black).
3. **Container Build**: `docker compose build` to ensure Dockerfiles compile without missing dependencies.
4. **Automated Tests**: Unit and integration test suites in `tests/`.

---

## 2. CD Deployment Strategy
- **Container Registry**: Images tagged with semantic version (`v1.0.0`) and git commit SHA (`sha-abc1234`).
- **Zero-Downtime Rolling Update**: In production, new containers become healthy before traffic is rerouted.
