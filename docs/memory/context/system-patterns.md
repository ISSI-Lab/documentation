# Shared AI Context Bank: System Patterns & Conventions

This document specifies reusable engineering patterns and code standards across the frontend and backend services.

---

## 1. Architectural Patterns
- **API-First Integration**: Define endpoint contracts in [`docs/design/api/`](../../design/api/) before writing frontend UI components or backend route handlers.
- **Stateless Services**: Frontend and backend containers must remain stateless; persistent data must reside in external databases or mounted volumes.
- **Fail-Fast Configuration**: Services must validate required environment variables at startup and crash with a descriptive error if variables are missing.

---

## 2. Docker & Container Patterns
- **Layer Caching**: Always copy package manifests (`package.json`, `requirements.txt`) and install dependencies *before* copying application source code in `Dockerfile`s.
- **Volume Mounts**: During development, host source directories are mounted (`./src/frontend:/app` and `./src/backend:/app`) to enable instant hot-reload without container rebuilds.
- **Container Isolation**: Internal container ports are standard (`3000` for frontend, `8000` for backend). Host ports can be mapped differently using environment variables (`FRONTEND_PORT`, `BACKEND_PORT`).
