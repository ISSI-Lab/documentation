# Retrospectives & Lessons Learned

This document logs key organizational insights, incident post-mortems, and technical pitfalls discovered during development.

---

## Retrospective Log

### 2026-09-10: Cross-Machine Development Challenges
- **Observation**: Mixing project documentation directly at root led to confusion between code and design files, and bloated Docker build contexts.
- **Action Taken**: Consolidated all documentation, design, and memory under `docs/`, while isolating application services inside `src/frontend` and `src/backend`. Added root `.dockerignore` to explicitly ignore `docs/`.
- **Outcome**: Build contexts remain under a few kilobytes, and root directory remains clean.
