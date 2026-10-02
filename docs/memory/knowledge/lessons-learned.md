# Retrospectives & Lessons Learned

This document logs key organizational insights, incident post-mortems, and technical pitfalls discovered during development.

---

## Retrospective Log

### 2026-10-02: MySQL Port Conflict (53306) & Production Proxy Port Drift
- **Observation**: Production deployment encountered `Bind for 0.0.0.0:13306 failed: port is already allocated` causing MySQL and dependent containers to fail startup. Furthermore, dynamic port auto-reallocation in `scripts/start.sh` treated existing project containers as conflicts, incrementing `FRONTEND_PORT` to 3940 and causing a `502 Bad Gateway` on Host Nginx (which stayed mapped to 3939).
- **Action Taken**: Shifted default MySQL host port to `53306` across configuration templates, Compose files, and scripts. Upgraded `scripts/start.sh` to check `docker ps` for project container ownership before probing ports, and locked ports against auto-incrementing in production mode (`--prod`).
- **Outcome**: Completely eliminated the 13306 host collision and prevented 502 Bad Gateway outages caused by reverse proxy port drift.

### 2026-09-27: Host Port Collisions & Dynamic Pre-Flight Resolution
- **Observation**: Running Docker Compose failed with `Bind for 0.0.0.0:13306 failed: port is already allocated` and `5000` (macOS AirPlay / local MySQL services occupying default host ports).
- **Action Taken**: Added an automated pre-flight socket binding verification function to [`scripts/start.sh`](../../../scripts/start.sh). Before launching Docker Compose, the script tests port bindability and dynamically shifts to the next available free port (e.g. `13306` $\rightarrow$ `13307`, `5000` $\rightarrow$ `5001`), exporting the resolved environment variable and updating `.env`.
- **Outcome**: Zero downtime or manual debugging needed on machines with port collisions across both development and production environments.

### 2026-09-26: Multi-Tier Host & Container Nginx Proxy Separation
- **Observation**: SSL certificates managed on the host via Certbot need to terminate traffic before proxying to containerized applications across multiple distinct domains on the same server.
- **Action Taken**: Structured a two-tier proxy where Host Nginx manages SSL (`/etc/letsencrypt/`) and Let's Encrypt webroot (`/var/www/certbot`), forwarding traffic via `proxy_pass http://127.0.0.1:3939` to the Container Nginx, which handles SPA static assets and internal `/api/` routing.
- **Outcome**: Clean separation of host ingress from container lifecycle; multiple domain apps can coexist on the same production host.

### 2026-09-10: Cross-Machine Development Challenges
- **Observation**: Mixing project documentation directly at root led to confusion between code and design files, and bloated Docker build contexts.
- **Action Taken**: Consolidated all documentation, design, and memory under `docs/`, while isolating application services inside `src/frontend` and `src/backend`. Added root `.dockerignore` to explicitly ignore `docs/`.
- **Outcome**: Build contexts remain under a few kilobytes, and root directory remains clean.
