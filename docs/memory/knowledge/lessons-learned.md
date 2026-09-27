# Retrospectives & Lessons Learned

This document logs key organizational insights, incident post-mortems, and technical pitfalls discovered during development.

---

## Retrospective Log

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
