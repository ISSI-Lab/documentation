# Pre-Release Verification Checklist

Execute this checklist before cutting a release or merging a release branch to `main`.

---

## 1. Documentation & Memory Verification
- [ ] Run `python3 scripts/validate_docs.py` to confirm zero broken links.
- [ ] Ensure all new architectural choices have a recorded ADR in `docs/memory/decisions/`.
- [ ] Ensure `docs/requirements/roadmap.md` is updated with delivered features.
- [ ] Ensure `docs/memory/context/active-context.md` reflects current sprint status.

---

## 2. Docker & Build Verification
- [ ] Run `docker compose build --no-cache` to ensure clean container builds.
- [ ] Run `docker compose up -d` and verify services respond:
  - Frontend: `curl -I http://localhost:3000`
  - Backend: `curl -I http://localhost:8000`
- [ ] Confirm no extraneous files were copied into images:
  ```bash
  docker compose exec frontend ls -la docs 2>&1 | grep "No such file"
  docker compose exec backend ls -la docs 2>&1 | grep "No such file"
  ```

---

## 3. Git Hygiene
- [ ] Confirm no secrets (`.env`) or local scratchpads (`*.local.md`) are tracked:
  ```bash
  git status --ignored
  ```
- [ ] Verify line endings: `git check-attr -a --all`
