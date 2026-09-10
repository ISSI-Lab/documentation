# System Architecture Overview

This document describes the multi-service containerized architecture of the application.

---

## 1. High-Level Container Topology

The application consists of isolated frontend and backend services orchestrated by Docker Compose on a dedicated virtual network (`app-net`):

```mermaid
graph TD
    User["Client Browser / User"]
    
    subgraph Host["Developer Workstation (macOS / Linux / Windows)"]
        subgraph DockerCompose["Docker Compose (app-net)"]
            Frontend["Frontend Service (web_frontend)<br/>Container Port: 3000<br/>Host Port: 3000"]
            Backend["Backend Service (web_backend)<br/>Container Port: 8000<br/>Host Port: 8000"]
        end
        
        SrcFrontend["Host: ./src/frontend"]
        SrcBackend["Host: ./src/backend"]
    end
    
    User -->|HTTP / localhost:3000| Frontend
    User -->|API / localhost:8000| Backend
    Frontend -.->|Internal RPC / http://backend:8000| Backend
    
    SrcFrontend ===|Volume Mount (Live Reload)| Frontend
    SrcBackend ===|Volume Mount (Live Reload)| Backend
```

---

## 2. Service Responsibilities

### Frontend Service (`src/frontend`)
- **Technology**: Node 20 / Vite / React / TypeScript (or static web server).
- **Responsibilities**:
  - Renders the user interface.
  - Consumes Backend REST endpoints based on [`docs/design/api/`](../api/).
  - Supports hot module replacement (HMR) during local development.

### Backend Service (`src/backend`)
- **Technology**: Python 3.11 / FastAPI (or Flask / Node Express).
- **Responsibilities**:
  - Serves REST/JSON API endpoints.
  - Implements business logic, validation, and authentication.
  - Interacts with databases or external services.

---

## 3. Communication Patterns
1. **Client-Side Communication**: The user's web browser makes asynchronous HTTP requests directly to `http://localhost:8000` (or through a reverse proxy).
2. **Server-Side Rendering / Proxy**: If SSR is enabled, the frontend container queries the backend container internally via DNS name `http://backend:8000` over the Docker bridge network `app-net`.
