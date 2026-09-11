# Data Models: Templates & Documents

This document describes the schemas and structural models for Document Templates, Document Elements, and Created Documents.

---

## 1. Document Element Configuration

Each template defines an ordered collection of `DocumentElementConfig` items:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier within the template (slug format, e.g. `elem_summary`). |
| `label` | `string` | User-facing section title (e.g. "Executive Summary"). |
| `description` | `string` | Guidance and instructions for the author when writing in this section. |
| `field_type` | `string` | Type of field: `markdown`, `short_text`, `select`, `callout`, `code`, `checklist`. |
| `placeholder` | `string` | Hint text displayed inside the editor when empty. |
| `default_value` | `string` | Initial markdown or starter boilerplate content pre-populated when a doc is created. |
| `required` | `boolean` | Whether the author must supply content before publishing. |
| `order` | `integer` | Sequence order for rendering in edit mode and view preview. |
| `options` | `list[string]` | Available choices when `field_type` is `select`. |

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
| `author` | `string` | Document author name. |
| `tags` | `list[string]` | Categorical tags. |
| `elements_data` | `dict[string, str]` | Key-value mapping of `element_id -> content`. |
| `compiled_markdown` | `string` | Dynamically generated single markdown document representing all elements. |
| `created_at` | `ISO 8601 string` | Timestamp of creation. |
| `updated_at` | `ISO 8601 string` | Timestamp of last update. |
