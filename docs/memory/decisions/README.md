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
| [0004](0004-user-authentication-and-hierarchical-team-collaboration.md) | User Authentication And Hierarchical Team Collaboration | Accepted | 2026-09-25 |
| [0005](0005-refactor-team-domain-to-organization.md) | Refactor Team Domain to Organization | Accepted | 2026-10-02 |
| [0006](0006-teams-and-reusable-project-team-assignment-sets.md) | Teams and Reusable Project Team Assignment Sets | Accepted | 2026-10-03 |
| [0007](0007-personal-and-team-document-submissions-and-review-system.md) | Personal and Team Document Submissions and Review System | Accepted | 2026-10-03 |
| [0008](0008-independent-personal-submittable-document-copies.md) | Independent Personal Submittable Document Copies | Accepted | 2026-10-04 |
| [0009](0009-pure-markdown-and-iterative-editable-elements.md) | Pure Markdown View-Only and Iterative Editable Document Elements | Accepted | 2026-10-04 |
| [0010](0010-grouped-iteration-elements-with-predefined-keys.md) | Grouped Iteration Elements with Predefined Keys per Iteration | Accepted | 2026-10-04 |

