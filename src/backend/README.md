# Backend API Service

This directory contains the backend API server application (e.g., FastAPI, Django, Flask, Express, or Go).

## Directory Layout
- `Dockerfile`: Multi-stage Docker container for development and production.
- `app/`: API endpoints, models, business logic, and database migrations.

## Running Locally via Docker
From the project root:
```bash
docker compose up backend
```
The backend will be accessible at `http://localhost:8000`.

## API Contracts
All exposed API routes and data schemas must be documented in [`docs/design/api/`](../../docs/design/api/) and [`docs/design/data-models/`](../../docs/design/data-models/).
