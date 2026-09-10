# Test Plan 0001: Multi-Service Architecture Verification

- **Status**: Active
- **Target**: Multi-Service Docker Architecture & Docs Hub
- **Author**: Core Team
- **Date**: 2026-09-10

---

## 1. Scope
Verifies that:
1. Docker Compose orchestrates frontend and backend containers cleanly without errors.
2. Volume mounting allows real-time code changes to reflect without container rebuilds.
3. Documentation and AI memory files are validated for link integrity and cross-platform naming.

---

## 2. Test Cases

### TC-01: Container Spin-up
- **Command**: `docker compose up --build -d`
- **Expected Outcome**: Containers `web_frontend` and `web_backend` enter `running` state.
- **Verification**: `docker compose ps` shows both services healthy/running.

### TC-02: Documentation Link Integrity
- **Command**: `python3 scripts/validate_docs.py`
- **Expected Outcome**: Zero broken markdown links; all filenames adhere to kebab-case.

### TC-03: Local Memory Git Isolation
- **Action**: Create a dummy file in `docs/memory/local/test.local.md`.
- **Command**: `git status --porcelain`
- **Expected Outcome**: `docs/memory/local/test.local.md` does NOT show up in git status.
