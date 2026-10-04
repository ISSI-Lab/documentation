# Data Models: Templates & Documents

This document describes the schemas and structural models for Document Templates, Document Elements, and Created Documents.

---

## 1. Document Element Configuration

Each template defines an ordered collection of `DocumentElementConfig` items:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier within the template (slug format, e.g. `elem_summary`). |
| `label` | `string` | User-facing section title (e.g. "Executive Summary"). |
| `description` | `string` | Guidance and instructions for the author when writing in this section (or Key in interactive field). |
| `field_type` | `string` | Type of field: `pure_markdown` (view-only), `interactive_field` (description & input), `iteration_group` (grouped list of items per iteration), `interactive_list` / `repeatable_list` (array of editable elements), `markdown`, `short_text`, `select`, `callout`, `code`, `checklist`. |
| `level` | `integer` | Hierarchy level: `1` (H2 Section), `2` (H3 Subsection), `3` (H4 Sub-item). |
| `placeholder` | `string` | Hint text displayed inside the editor when empty. |
| `default_value` | `any` | Initial markdown text, array of `IterationGroupItem` objects for `iteration_group`, or array of `EditableItem` objects for `interactive_list` / `repeatable_list`. |
| `required` | `boolean` | Whether the author must supply content before publishing. |
| `order` | `integer` | Sequence order for rendering in edit mode and view preview. |
| `options` | `list[string]` | Available choices when `field_type` is `select`. |
| `view_markdown` | `string` | Optional pure markdown text part strictly for viewing (rendered read-only in editor). |
| `iteration_fields` | `list[IterationFieldConfig]` | Configured list of fixed keys for `iteration_group` elements (e.g. Reason, Todo, Response). |

### Grouped Iteration Element Schema (`iteration_group`)
For elements with `field_type: "iteration_group"`, the template creator configures a fixed set of keys per iteration via `iteration_fields`:
```json
"iteration_fields": [
  { "key": "Reason", "description": "Explanation or root cause", "placeholder": "Enter reason..." },
  { "key": "Todo", "description": "Action items to be taken", "placeholder": "Enter action items..." },
  { "key": "Response", "description": "Observed outcome or system response", "placeholder": "Enter response..." }
]
```
The document writer cannot rename or change these keys; for each iteration (Iteration #1, Iteration #2, ... Iteration #N), they only fill in the values for the predefined keys:
```json
[
  {
    "id": "iter_1726058400_1",
    "iteration_number": 1,
    "title": "Iteration #1",
    "values": {
      "Reason": "High 500 error rate on API Gateway",
      "Todo": "Inspect upstream connection pool metrics",
      "Response": "Connection pool was saturated during peak traffic"
    }
  },
  {
    "id": "iter_1726058400_2",
    "iteration_number": 2,
    "title": "Iteration #2",
    "values": {
      "Reason": "Slow database queries holding pool connections",
      "Todo": "Add composite index on sessions table",
      "Response": "Query latency dropped to <5ms, errors eliminated"
    }
  }
]
```

### Iterative Editable Element Schema (`EditableItem` / `RepeatableSubItem`)
For legacy dynamic lists (`interactive_list` / `repeatable_list`), items added dynamically via the `+` button represent an iterative array of editable elements where each element is a `description - value` pair:
```json
{
  "id": "sub_1726058400_1",
  "description": "Option 1: PostgreSQL Database",
  "value": "### Analysis\n- Low latency\n- Strong ACID guarantees",
  "title": "Option 1: PostgreSQL Database",
  "content": "### Analysis\n- Low latency\n- Strong ACID guarantees"
}
```


---

## 2. Template Model

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique template identifier (e.g. `tpl-adr`). |
| `title` | `string` | Name of the template (e.g. "Architecture Decision Record"). |
| `description` | `string` | High-level summary of what this document template is intended for. |
| `category` | `string` | Categorization (e.g. "Engineering", "Product", "Operations"). |
| `icon` | `string` | Lucide icon name for visual representation. |
| `document_elements` | `list[DocumentElementConfig]` | Ordered list of configured document elements. |
| `created_at` | `ISO 8601 string` | Timestamp of creation. |
| `updated_at` | `ISO 8601 string` | Timestamp of last modification. |

---

## 3. Document Model

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique document UUID. |
| `title` | `string` | Document title. |
| `template_id` | `string` | Foreign ID referencing the source template. |
| `template_title` | `string` | Display name of the source template. |
| `status` | `string` | Workflow status: `draft`, `in_review`, `approved`, `published`. |
| `document_type` | `string` | Collaboration model: `personal` (individual document) or `project_shared` (collaborative editing). |
| `is_submittable` | `boolean` | Whether participants/teams submit responses for creator review. |
| `author` | `string` | Document author name. |
| `tags` | `list[string]` | Categorical tags. |
| `elements_data` | `dict[string, any]` | Key-value mapping of `element_id -> content`. |
| `compiled_markdown` | `string` | Dynamically generated single markdown document representing all elements. |
| `submissions_count` | `integer` | Count of active submissions (when `is_submittable: true`). |
| `created_at` | `ISO 8601 string` | Timestamp of creation. |
| `updated_at` | `ISO 8601 string` | Timestamp of last update. |

---

## 4. Document Submission Model (`DocumentSubmission`)

Represents an individual student's or team's submitted response to a submittable deliverable document.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique submission identifier (`subm-...`). |
| `document_id` | `string` | Parent deliverable document UUID. |
| `project_id` | `string` | Associated project UUID. |
| `submission_type` | `string` | Submission mode: `personal` (individual) or `team` (shared deliverable). |
| `user_id` | `string` | Member UUID (required for `personal` submissions, submitter for `team`). |
| `team_id` | `string` | Assigned team UUID (for `team` submissions). |
| `status` | `string` | Submission status: `draft`, `submitted`, `reviewed`. |
| `elements_data` | `dict[string, any]` | Key-value mapping of answers to template elements. |
| `compiled_markdown` | `string` | Rendered compiled markdown document for this submission. |
| `submitted_at` | `ISO 8601 string` | Timestamp of submission, or `null` if draft. |
| `created_at` | `ISO 8601 string` | Timestamp of creation. |
| `updated_at` | `ISO 8601 string` | Timestamp of last modification. |
| `comments_count` | `integer` | Total comments/feedback messages posted on this submission. |

---

## 5. Submission Comment Model (`SubmissionComment`)

Represents bidirectional feedback comments between project creators/reviewers and submitting participants or teams.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique comment identifier. |
| `submission_id` | `string` | Target submission UUID. |
| `user_id` | `string` | Author user UUID. |
| `user_name` | `string` | Display name of author. |
| `content` | `string` | Markdown/text content of the review feedback or reply. |
| `created_at` | `ISO 8601 string` | Timestamp of comment. |
| `updated_at` | `ISO 8601 string` | Timestamp of last update. |

