# Frontend Web Application Service

This directory contains the frontend client application (e.g., React, Vue, Svelte, Next.js, or HTML/JS).

## Directory Layout
- `Dockerfile`: Multi-stage Docker container for development and production.
- `app/`: Application components, pages, routes, and static assets.

## Running Locally via Docker
From the project root:
```bash
docker compose up frontend
```
The frontend will be accessible at `http://localhost:3000`.

## API Communication
All requests to backend APIs must adhere to the shared contract documented in [`docs/design/api/`](../../docs/design/api/).
- In development: communicates with backend via `http://localhost:8000` (browser) or `http://backend:8000` (server-side).
