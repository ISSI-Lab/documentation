# Technical Design & Specifications Hub

This directory contains all architecture blueprints, design proposals (RFCs), API contracts, data models, and UI specifications.

---

## Subdirectories

- **[`architecture/`](architecture/)**: High-level system architecture, service topology, and container boundaries.
  - See [`00-system-overview.md`](architecture/00-system-overview.md) for the multi-container interaction diagram.
- **[`rfcs/`](rfcs/)**: Request for Comments for major architectural changes.
  - See [`0001-rfc-process.md`](rfcs/0001-rfc-process.md) for how proposals are drafted and approved.
- **[`api/`](api/)**: Shared API contracts (REST, OpenAPI, GraphQL) governing communication between `src/frontend` and `src/backend`.
- **[`data-models/`](data-models/)**: Database schemas, entity-relationship diagrams (ERDs), and message formats.
- **[`ui-ux/`](ui-ux/)**: Wireframes, component trees, and design tokens.
- **[`diagrams/`](diagrams/)**: Raw source files for diagrams (Mermaid `.mmd`, PlantUML, SVG).

---

## Design Principles
1. **Contract-First Development**: Before writing cross-service code, document the endpoint schema in [`api/`](api/).
2. **Mermaid for Diagrams**: Use Mermaid format inside markdown files so diagrams render natively on GitHub/GitLab without needing external image generation tools.
3. **Decoupled Evolution**: Frontend and backend services should communicate strictly over documented APIs.
