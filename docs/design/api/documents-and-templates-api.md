# API Specification: Templates & Document Authoring

This document defines the formal contract for template configuration, document lifecycle, and markdown authoring endpoints.

---

## 1. Base URL
- Development: `http://localhost:8000/api/v1`
- Container: `http://backend:8000/api/v1`

---

## 2. Template Endpoints

### `GET /api/v1/templates`
List all configured templates.

**Response `200 OK`**:
```json
[
  {
    "id": "tpl-adr",
    "title": "Architecture Decision Record",
    "description": "Capture architectural context, options, and decisions.",
    "category": "Architecture",
    "icon": "layers",
    "document_elements": [
      {
        "id": "context",
        "label": "Context & Problem Statement",
        "description": "What problem or business context is motivating this decision?",
        "field_type": "markdown",
        "placeholder": "Describe the context...",
        "default_value": "### Context\n\n- Current limitations...\n- Business goals...",
        "required": true,
        "order": 0
      }
    ],
    "created_at": "2026-09-10T16:00:00Z",
    "updated_at": "2026-09-10T16:00:00Z"
  }
]
```

### `POST /api/v1/templates`
Create a new template with custom document elements.

**Request Body**:
```json
{
  "title": "Incident Postmortem",
  "description": "Root cause analysis and prevention roadmap",
  "category": "Operations",
  "icon": "alert-triangle",
  "document_elements": [
    {
      "id": "summary",
      "label": "Executive Summary",
      "description": "Brief summary of what happened.",
      "field_type": "markdown",
      "placeholder": "Incident summary...",
      "default_value": "On [Date], service [Name] experienced an outage...",
      "required": true,
      "order": 0
    }
  ]
}
```

### `GET /api/v1/templates/{id}`
Retrieve a specific template by ID.

### `PUT /api/v1/templates/{id}`
Update an existing template and its elements.

### `DELETE /api/v1/templates/{id}`
Delete a template by ID.

### `POST /api/v1/templates/reset-seeds`
Resets the template store with default industry-standard templates (ADR, PRD, Technical Design, Postmortem).

---

## 3. Document Endpoints

### `GET /api/v1/documents`
List documents with optional query params `?template_id=` and `?search=`.

**Response `200 OK`**:
```json
[
  {
    "id": "doc-uuid-1234",
    "title": "ADR-0003: Redis Caching Strategy",
    "template_id": "tpl-adr",
    "template_title": "Architecture Decision Record",
    "status": "draft",
    "author": "Engineering Lead",
    "tags": ["backend", "cache", "performance"],
    "created_at": "2026-09-10T16:00:00Z",
    "updated_at": "2026-09-10T16:30:00Z"
  }
]
```

### `POST /api/v1/documents`
Create a document based on a template. Automatically initializes element fields with template default values.

**Request Body**:
```json
{
  "title": "ADR-0003: Redis Caching Strategy",
  "template_id": "tpl-adr",
  "author": "Engineering Lead",
  "tags": ["performance", "redis"],
  "elements_data": {
    "context": "Initial custom notes..."
  }
}
```

### `GET /api/v1/documents/{id}`
Retrieve full document details, element data, and compiled markdown.

### `PUT /api/v1/documents/{id}`
Update document contents, title, status, or tags.

**Request Body**:
```json
{
  "title": "ADR-0003: Redis Caching Strategy (Approved)",
  "status": "approved",
  "elements_data": {
    "context": "Finalized context...",
    "decision": "We will use Redis v7 cluster..."
  }
}
```

### `DELETE /api/v1/documents/{id}`
Delete a document by ID.

### `GET /api/v1/documents/{id}/export/markdown`
Returns raw compiled Markdown text with `Content-Type: text/markdown`.

---

## 4. Document Submissions & Creator Review Endpoints

Submittable documents (`is_submittable: true`) support structured student/participant deliverables and creator review workflows.

### `GET /api/v1/documents/{id}/submissions`
Retrieve the review roster for the document.
- **Project Creators / Reviewers**: Returns all expected participants (for `personal` documents) or all assigned teams (for `project_shared` documents), indicating whether their submission is `not_started`, `draft`, `submitted`, or `reviewed`.
- **Participants**: Returns the caller's active submission.

### `GET /api/v1/documents/{id}/my-submission`
Retrieve or auto-initialize the caller's submission draft.
- For `personal` documents, returns the individual caller's submission pre-populated with creator defaults.
- For `project_shared` documents, returns the caller's assigned team submission pre-populated with creator defaults.

### `GET /api/v1/documents/{id}/submissions/{submissionId}`
Retrieve full submission content, compiled markdown, and comment thread.

### `PUT /api/v1/documents/{id}/submissions/{submissionId}`
Update submission draft element data and dynamically re-compile markdown.

**Request Body**:
```json
{
  "elements_data": {
    "context": "Our updated architectural proposal...",
    "decision": "Adopted gRPC service contracts."
  }
}
```

### `POST /api/v1/documents/{id}/submissions/{submissionId}/submit`
Mark deliverable as submitted (`status: "submitted"`, records `submitted_at`).

### `POST /api/v1/documents/{id}/submissions/{submissionId}/unsubmit`
Revert deliverable back to draft (`status: "draft"`), allowing the author or team to make revisions before review.

### `PUT /api/v1/documents/{id}/submissions/{submissionId}/status`
Update review status (`reviewed`, `draft`, `submitted`). Restricted to project creators and organization managers.

### `GET /api/v1/documents/{id}/submissions/{submissionId}/comments`
Retrieve chronological feedback comments for the submission.

### `POST /api/v1/documents/{id}/submissions/{submissionId}/comments`
Post review feedback or participant reply.

**Request Body**:
```json
{
  "content": "Detailed review feedback on architecture components."
}
```

