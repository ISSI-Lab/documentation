# Docker Development & Deployment Workflows

Runbook for managing, troubleshooting, and operating the container stack across Development and Production.

---

## 1. Unified Application Management (`scripts/start.sh` & `scripts/stop.sh`)

### Development
```bash
# Start all services in Development mode (Attached / Foreground live logs, phpMyAdmin on port 28080)
# Press Ctrl+C to stop
./scripts/start.sh

# Rebuild containers after code or manifest changes
./scripts/start.sh --build
```

### Production
```bash
# First-time production setup (prompts for domain, generates Host Nginx SSL config, runs in background)
./scripts/start.sh --prod --init

# Normal production startup (detached background mode, phpMyAdmin disabled by default)
./scripts/start.sh --prod

# Production startup with phpMyAdmin enabled (calls enable-pma.sh)
./scripts/start.sh --prod -pma

# Enable / Start phpMyAdmin on demand in production anytime:
./scripts/enable-pma.sh

# Check phpMyAdmin status:
./scripts/enable-pma.sh --status

# Stop / Disable phpMyAdmin on demand:
./scripts/enable-pma.sh --stop
```

### Stopping & Terminating Containers
```bash
# Graceful stop and container removal (preserves database volume)
./scripts/stop.sh

# Full termination and persistent volume wipe
./scripts/stop.sh --volumes
```

---

## 2. Interactive Shell Access

```bash
# Open a shell inside the running backend container
docker compose exec backend sh

# Open a shell inside the running frontend container
docker compose exec frontend sh

# Open a MySQL shell inside the database container
docker compose exec mysql mysql -u docuser -pdocpass docforge
```

---

## 3. Troubleshooting & Automated Port Conflict Resolution

### Automatic Port Collision Handling
When starting via `./scripts/start.sh`, the script automatically tests whether host ports (`FRONTEND_PORT: 3939`, `BACKEND_PORT: 5000`, `MYSQL_PORT: 53306`, `PMA_PORT: 28080`) are available to bind.
- If a port is occupied by another external process, `start.sh` in development automatically shifts to the next free port, exports the resolved port, and updates `.env`. In production (`--prod`), ports are locked to prevent breaking reverse proxy routing.

### Manual Port Overrides
To permanently assign custom ports, edit `.env`:
```bash
FRONTEND_PORT=3940
BACKEND_PORT=5002
MYSQL_PORT=13308
PMA_PORT=28081
```
Then run `./scripts/start.sh`.

---

## 4. Email & SMTP Service Management (`email_config.json`)

DocForge stores email credentials in `src/backend/config/email_config.json` encrypted with AES-256-GCM.
- In `docker-compose.yml`, `./src/backend/config` is mounted read-only to `/app/config:ro` in the backend container.
- The encryption key is injected via `EMAIL_CONFIG_SECRET=${EMAIL_CONFIG_SECRET:-docforge-email-secret-key-2026}`.
- Configure or update credentials on the host using:
  ```bash
  ./scripts/setup_email.sh
  ```
  Changes take effect immediately without rebuilding container images.
- For complete setup instructions and registration verification details, see [`email-configuration-guide.md`](email-configuration-guide.md).
