# Shared AI Context Bank: Project Context

This document is loaded by AI coding assistants (Antigravity, Cursor, Copilot) and reviewed by human developers to maintain institutional context across machines.

---

## 1. Project Purpose & Scope
This project provides a robust, multi-service web platform designed for cross-platform team collaboration, ensuring requirements, designs, and development state are versioned alongside source code.

---

## 2. Technology Stack Overview
- **Orchestration**: Docker Compose (v2+), Docker (v24+)
- **Frontend**: Node 20 / TypeScript / Modern Web Framework (Vite / React)
- **Backend**: Python 3.11 / FastAPI (or Flask / Node)
- **Shared Network**: Bridge network (`app-net`)
- **Documentation**: Markdown + Mermaid diagrams under `docs/`
- **Automation Scripts**: Cross-platform Python 3.8+ (`scripts/`)

---

## 3. Directory Layout Rules
- All documentation, designs, and team memories must remain inside `docs/`.
- All web application code belongs inside `src/frontend/` or `src/backend/`.
- Never put transient files or application source code directly at the root.
