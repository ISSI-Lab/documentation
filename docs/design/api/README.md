# API Specifications & Shared Contracts

This directory contains the formal API contracts governing the interaction between `src/frontend/` and `src/backend/`.

---

## 1. Core Endpoints Specification

### Base URLs
- **Local Development (Client-side)**: `http://localhost:8000/api/v1`
- **Container-to-Container (Server-side)**: `http://backend:8000/api/v1`

---

## 2. Standard Endpoints

### Health Check
- **Route**: `GET /api/v1/health`
- **Description**: Verifies service status and database connectivity.
- **Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-10T16:00:00Z",
  "version": "1.0.0"
}
```

### System Configuration / Status
- **Route**: `GET /api/v1/system/info`
- **Description**: Returns non-sensitive system status for frontend display.
- **Response**:
```json
{
  "environment": "development",
  "features": {
    "auth": true,
    "websockets": false
  }
}
```

---

## 3. Error Response Format
All API error responses must adhere to RFC 7807 (Problem Details):

```json
{
  "type": "https://example.com/errors/invalid-parameters",
  "title": "Invalid Request Parameters",
  "status": 400,
  "detail": "Field 'username' cannot be blank."
}
```

---

## 4. OpenAPI / Swagger Specs
When available, place the raw OpenAPI YAML/JSON files in this directory (e.g. `openapi.yaml`). Frontend code generation tools should consume this file directly.
