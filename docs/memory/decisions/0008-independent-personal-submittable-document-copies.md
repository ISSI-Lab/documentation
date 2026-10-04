# ADR-0008: Independent Copy Instance Isolation for Personal and Team Submittable Documents

- **Status**: Accepted
- **Date**: 2026-10-04
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
In our document authoring platform, documents can be either `personal` (individual ownership) or `project_shared` (collaborative editing within a project). Both types can be designated as submittable deliverables (`is_submittable = true`).

When a project creator publishes a submittable document (such as an assignment prompt, milestone rubric, or architecture template):
1. **Personal Deliverables**: Each participant must have their own independent document copy. Non-creators must not overwrite the creator's master document in-place, and participants must not see or overwrite each other's work.
2. **Team Deliverables**: Each functional squad assigned to the project must have their own shared document copy. Whoever in the team is the first to open the submittable document must create the copy for the team. All members of that team must share editing on that copy, while remaining isolated from other teams and leaving the creator's master document completely pristine.

Previously, `PUT /api/v1/documents/:id` allowed any organization member with project access to overwrite `elements_data` of documents directly. This caused non-creator edits to overwrite the creator's master document, and prevented different teams from maintaining independent working copies.

## Decision
We committed to an **Independent Copy Instance Isolation** architecture supporting both individual and team collaboration models:

1. **Strict Creator-Only Mutation on Master Submittable Documents**:
   - `PUT /api/v1/documents/:id` and `DELETE /api/v1/documents/:id` enforce that if a document is a published master deliverable (`is_submittable = TRUE` and `copied_from_id IS NULL`), only the document creator (or organization manager) can mutate or delete it. Any non-creator edit attempt is rejected with `403 Forbidden`.
   - For non-submittable personal documents, edits and deletions remain strictly creator-only.

2. **Automated Copy Provisioning (`POST /api/v1/documents/:id/copy`)**:
   - **Personal Documents**:
     - Provisions or returns an individual copy: `copied_from_id = masterDoc.id`, `created_by = caller.id`, `assigned_team_id = NULL`.
     - Idempotent: checks `SELECT ... WHERE copied_from_id = ? AND created_by = ?`.
   - **Team Shared Documents**:
     - Determines the caller's assigned team in the project (`project_team_assignments` + `organization_team_members`).
     - Idempotent per team: checks `SELECT ... WHERE copied_from_id = ? AND assigned_team_id = ?`.
     - **Whoever in the team firstly opens the document creates the copy for the team**:
       - If no copy exists for that team, inserts a new document: `copied_from_id = masterDoc.id`, `assigned_team_id = team.id`, `document_type = 'project_shared'`, `is_submittable = TRUE`, `author = team.name`, `created_by = first_user.id`.
       - If a copy already exists for that team, returns the existing team copy.
       - Any subsequent member of that team who opens or edits the document receives that same team copy to share editing.
     - Different teams receive distinct document copies, guaranteeing isolation across teams.

3. **Two-Way Synchronization with Submissions**:
   - Updates made to a personal copy (`PUT /documents/:id`) automatically update the individual submission in `document_submissions` (`document_id = masterDoc.id`, `user_id = caller.id`).
   - Updates made to a team copy (`PUT /documents/:id`) automatically update the team submission in `document_submissions` (`document_id = masterDoc.id`, `team_id = team.id`).
   - Reciprocally, updates made in the submission workspace (`PUT /documents/:id/submissions/:submId`) automatically sync elements and markdown back into the corresponding document copy in `documents`.

4. **Catalog & Query Visibility Scoping**:
   - In `GET /api/v1/documents`:
     - Master documents (`copied_from_id IS NULL`) are visible to all members with project/org access.
     - Personal copies (`copied_from_id IS NOT NULL AND assigned_team_id IS NULL`) are visible only to their author.
     - Team copies (`copied_from_id IS NOT NULL AND assigned_team_id IS NOT NULL`) are visible only to members of that assigned team (and copy creator). Other teams do not see them.

5. **Frontend UI Guardrails & Workflows**:
   - `DocumentList.tsx`: Surfaces dynamic badges ("Personal Copy" vs "Team Copy", "Copy Active" vs "Team Copy Active") and buttons ("Edit My Copy", "Copy & Edit", "Edit Team Copy", "Start Team Copy").
   - `DocumentViewer.tsx`: Renders context-sensitive "Start / Edit My Copy" or "Start / Edit Team Copy" actions, hiding creator review panels on copied instances.
   - `DocumentEditor.tsx`: Read-only guardrails with warning banners for non-creators on master documents, and informative working instance indicators for personal and team copies.

## Consequences

### Positive
- **Guaranteed Master Document Integrity**: Creators never have their published prompts, guidelines, or specs overwritten by students or teams.
- **Team Collaboration with Inter-Team Isolation**: Members of a squad share editing seamlessly on their squad's copy, while other squads work on independent copies.
- **First-Open Initialization**: Eliminates manual scaffolding; opening the document automatically provisions the team's shared copy.
- **Seamless Review Integration**: Drafts from personal and team copies automatically reflect in the creator review roster with zero extra steps.

### Negative / Trade-offs
- **Additional Rows in `documents` Table**: Handled with `idx_copied_from_id` and `idx_assigned_team_id` indexes and scoped catalog filtering.
