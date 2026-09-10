# Docker Development Workflows

Runbook for managing, troubleshooting, and developing with Docker Compose.

---

## 1. Daily Development Commands

```bash
# Start all services (frontend + backend) in the foreground
docker compose up

# Start services in the background (detached mode)
docker compose up -d

# View live output logs of all services
docker compose logs -f

# View live logs of only the backend
docker compose logs -f backend

# Rebuild containers after changing package manifests (package.json or requirements.txt)
docker compose up --build

# Stop all containers
docker compose down

# Stop containers and remove volumes (clean reset)
docker compose down -v
```

---

## 2. Interactive Shell Access

```bash
# Open a bash shell inside the running backend container
docker compose exec backend sh

# Open a shell inside the running frontend container
docker compose exec frontend sh
```

---

## 3. Troubleshooting Common Docker Issues

### Port Already in Use (e.g., Port 3000 or 8000)
If port 3000 or 8000 is occupied by another local service, override the host ports in `.env`:
```bash
FRONTEND_PORT=3001
BACKEND_PORT=8001
```
Then run `docker compose up -d`.

### Stale File Caching
If your code changes are not reflecting:
```bash
docker compose restart
```
