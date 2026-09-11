# Architecture Decision Records (ADRs)

Architecture Decision Records (ADRs) capture significant architectural and technical choices made during the lifetime of this project, along with the context, trade-offs, and consequences.

## Why ADRs?
- Prevent recurring debates over previously resolved architectural questions.
- Preserve context when new developers or AI agents join the project.
- Provide a clear, append-only history that avoids merge conflicts across distributed branches.

## Process
To create a new ADR, run:
```bash
python3 scripts/new_record.py adr "decision-title"
```

## ADR Registry
| ID | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| [0001](0001-record-architecture-decisions.md) | Record Architecture Decisions | Accepted | 2026-09-10 |
| [0002](0002-multi-service-docker-architecture.md) | Multi-Service Docker Architecture with Clean Docs Hub | Accepted | 2026-09-10 |
| [0003](0003-host-nginx-container-react-node-mysql-architecture.md) | Multi-Tier Host Nginx -> Container Nginx+ReactJS -> NodeJS -> MySQL Architecture | Accepted | 2026-09-11 |

