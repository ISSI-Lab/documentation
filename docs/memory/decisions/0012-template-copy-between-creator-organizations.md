# ADR-0012: Template Copy Between Creator Organizations

- **Status**: Accepted
- **Date**: 2026-10-04
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
In our multi-tenant technical documentation platform, document templates define the structure, section hierarchy, field types, and iterative schemas used to author specifications (such as ADRs, PRDs, RFCs, and Incident Postmortems).

With the introduction of Democratic Organization Collaboration ([ADR-0005](0005-refactor-team-domain-to-organization.md)) and Organization Teams with Creator Governance ([ADR-0006](0006-teams-and-reusable-project-team-assignment-sets.md)), users frequently create multiple organizations (e.g. departmental squads, dedicated engineering organizations, client spaces, or personal workspaces). 

Previously:
1. Templates configured in one organization were strictly confined to that single organization's namespace.
2. If an organization creator or template author wanted to standardize and reuse proven templates across their other organizations, they were forced to manually recreate the entire template schema section-by-section.
3. There was no mechanism or API to duplicate an organization template into another organization created by the user, while preserving security guardrails against unauthorized data leakage.

## Decision
We introduced **Template Copying Between Creator Organizations** across the backend API, database queries, frontend UI components, and test automation.

### 1. Security & Authorization Guardrails
- **Source Template Access**:
  - The template must exist and belong to an organization (`template.organization_id IS NOT NULL`).
  - The caller must be authenticated and must have creator/management authority: either the template's creator (`template.created_by = user.id`), the source organization's creator (`source_org.created_by = user.id`), or an organization manager. Non-creators cannot copy proprietary organization templates.
- **Target Organization Governance**:
  - The target organization must be **an organization where the caller is the creator** (`isOrganizationCreator(user.id, targetOrgId)`). This strictly adheres to the principle of "to the creator's other organization", preventing unauthorized users from injecting templates into organizations they do not govern.
- **Self-Copy Prevention**:
  - Copying a template into the same organization (`target_organization_id === source_organization_id`) is rejected with `400 Bad Request`.

### 2. Backend API Endpoint
- **`POST /api/v1/templates/:id/copy`**:
  - **Request Body**:
    ```json
    {
      "target_organization_id": "org-xxxx",
      "title": "Architecture Decision Record (Optional Custom Name)"
    }
    ```
  - **Behavior**:
    - Validates source template existence and permissions.
    - Validates target organization existence and creator role.
    - Performs deep sanitization of all document elements (including standard Markdown, interactive fields, repeatable lists, and nested iterative containers).
    - Preserves tags, icon, category, and description.
    - Scopes the newly created template to `target_organization_id` with `visibility = 'private'` and `created_by = caller.id`.
  - **Response `201 Created`**: Returns the complete copied `Template` object with creator attribution (`creator_name`, `creator_username`).

### 3. Creator Attribution on Templates
- Extended backend queries (`GET /api/v1/templates`, `GET /api/v1/templates/:id`, `POST`, `PUT`) to `LEFT JOIN users u ON t.created_by = u.id` to retrieve `creator_name` and `creator_username`.
- Extended `Template` models in both [`src/backend/src/models.ts`](../../../src/backend/src/models.ts) and [`src/frontend/src/types/index.ts`](../../../src/frontend/src/types/index.ts).
- Surfaced creator attribution badges on template cards across [`TemplateList.tsx`](../../../src/frontend/src/components/templates/TemplateList.tsx).

### 4. Frontend User Experience
- **Dedicated Modal ([`CopyTemplateModal.tsx`](../../../src/frontend/src/components/templates/CopyTemplateModal.tsx))**:
  - Presents source template summary (title, section count, origin organization).
  - Filters destination organization dropdown strictly to **The Creator's Other Organizations** (`org.is_creator === true && org.id !== sourceOrgId`).
  - Pre-fills destination template title while allowing optional customization.
  - If the user has no other creator organizations, renders an informative empty state with a direct button to create a new organization.
- **Direct Card & Builder Actions**:
  - Card Action on [`TemplateList.tsx`](../../../src/frontend/src/components/templates/TemplateList.tsx): Prominent `Copy` icon button adjacent to Edit and Delete actions for eligible creators.
  - Builder Action on [`TemplateBuilder.tsx`](../../../src/frontend/src/components/templates/TemplateBuilder.tsx): "Copy to Another Org" button in the top action bar when editing organization templates.
- **Reactive Workflow Transition**:
  - Upon successful copy, the active organization switcher automatically pivots to the target organization and refreshes the template list so the user immediately views the newly duplicated template.

---

## Consequences

### Positive
- Enables friction-free dissemination of standardized engineering and architectural templates across an author's multiple organizations.
- Guarantees organizational data safety by strictly enforcing that only creators can copy templates to organizations they own.
- Independent template instances allow each organization to adapt and evolve the copied template without impacting the original blueprint.
- Adds creator attribution badges on template cards for enhanced accountability.

### Negative / Trade-offs
- The copied template is decoupled from the source template; subsequent upstream changes to the source template do not propagate automatically to copied templates (by design, to preserve organization autonomy).
