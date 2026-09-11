# RFC-0002: Document Templating, Dynamic Element Configuration & Markdown Authoring Engine

- **Status**: Implemented
- **Date**: 2026-09-11
- **Author**: Engineering Team & AI Assistant
- **Target Release**: v1.0.0

---

## 1. Executive Summary

DocForge introduces a structured, template-driven documentation engine. Instead of forcing authors to write unguided, freeform markdown from scratch, teams configure reusable **Document Templates** composed of custom **Document Elements** (rich markdown fields, single-line text, dropdowns, callouts, code blocks, and checklists). 

When creating documents from a template, authors are presented with a dynamically generated **Edit Mode** with contextual guidance, boilerplate content, formatting toolbars, and table of contents outlines. A unified **View / Preview Mode** compiles these discrete elements into standard, publication-ready GitHub-Flavored Markdown with instant copy and download capabilities.

---

## 2. Motivation & Problem Statement

Engineering teams frequently suffer from inconsistent documentation:
- Architecture Decision Records (ADRs) miss trade-off analysis or validation plans.
- Product Requirement Documents (PRDs) lack uniform acceptance criteria.
- Incident Postmortems vary wildly in timeline structure and root cause rigor.
- Developers find writing repetitive boilerplate tedious, leading to low documentation velocity.

By turning templates into configurable schemas with pre-defined markdown fields and guidance prompts, documentation becomes structured, repeatable, and automated.

---

## 3. Detailed Architecture & Design

### A. Document Element Schema (`DocumentElementConfig`)

Each template contains an ordered array of element configurations:

```json
{
  "id": "context",
  "label": "1. Context & Problem Statement",
  "description": "Describe the technical context motivating this change.",
  "field_type": "markdown",
  "placeholder": "What problem are we trying to solve?",
  "default_value": "### Context\n- Current system limitations...",
  "required": true,
  "order": 0,
  "options": null
}
```

#### Supported Element Types:
1. **`markdown`**: Multi-line markdown editor equipped with a formatting toolbar (H2, H3, Bold, Italic, Code, Lists, Quotes, Tables, Links) and per-section write/preview tabs.
2. **`short_text`**: Clean single-line input for titles, versions, or short metadata.
3. **`select`**: Controlled dropdown populated from a configurable options array.
4. **`callout`**: Formatted note/alert block (`> [!NOTE]`).
5. **`code`**: Monospace code snippet block with dark editor styling.
6. **`checklist`**: Interactive task checklist with `- [ ]` and `- [x]` syntax.

---

### B. Dynamic Edit Mode Engine (`DocumentEditor.tsx`)

The editor dynamically renders the input form by inspecting the template's `document_elements`:
1. **Table of Contents Sidebar**: Automatically builds a navigation index showing completion state (green filled dot vs gray empty circle) and required indicators. Clicking an entry smoothly scrolls to that element.
2. **Contextual Author Guidance**: Each element renders an inline guidance callout explaining what to write.
3. **Markdown Toolbar**: Injects markdown syntax at cursor position without breaking text flow.
4. **Split Mode**: Side-by-side editing pane providing an instant, real-time preview of the compiled document.
5. **Shortcuts & Autosave**: Auto-saves changes with debounce and supports `Ctrl+S` / `Cmd+S`.

---

### C. Markdown Compilation Pipeline (`compiler.ts`)

The compiler processes document elements deterministically into a single GitHub-Flavored Markdown string:
1. **Header Block**: Emits `# {title}`, metadata chips (`**Template:** ... | **Status:** ... | **Author:** ... | **Tags:** ...`), and a divider rule `---`.
2. **Section Hierarchy**: Emits `## {element.label}` for each element in ascending order.
3. **Format Mapping**:
   - `markdown`: Emits raw markdown content or fallback message.
   - `short_text`: Emits paragraph text.
   - `select`: Emits `**Selection:** {value}`.
   - `callout`: Prefixes lines with `> [!NOTE]\n> {line}`.
   - `code`: Wraps text in triple backticks.
   - `checklist`: Formats lines as `- [ ]` or `- [x]`.

---

### D. Preview Mode & Export Capabilities (`DocumentViewer.tsx`)

- **Typographic Presentation**: Styled via `.prose-custom` with proportional heading scales, bordered tables, syntax code blocks, and blockquotes.
- **Copy Markdown**: One-click clipboard copy of the full compiled `.md` string.
- **Download `.md`**: Serves a downloadable file named `{sanitized-title}.md`.
- **Print / PDF**: `@media print` CSS formats the document into a clean white-sheet printable report.

---

## 4. Database Schema & Storage

Implemented in MySQL 8.0 (`src/backend/db/init.sql`):
- `templates`: `id`, `title`, `description`, `category`, `icon`, `document_elements` (JSON), timestamps.
- `documents`: `id`, `title`, `template_id`, `template_title`, `status`, `author`, `tags` (JSON), `elements_data` (JSON), `compiled_markdown` (LONGTEXT), timestamps.

Pre-seeded templates on first boot:
- **ADR**: Context, Decision Drivers, Considered Options, Outcome, Pros & Cons, Validation.
- **PRD**: Executive Summary, Personas, User Stories, Functional Specs, Milestones.
- **Incident Postmortem**: Brief, Severity Tier, Impact Timeline, Root Cause (5 Whys), Action Items.

---

## 5. Security & Verification

- SQL queries use parameterized prepared statements preventing SQL injection.
- Container Nginx isolates frontend from raw host ports.
- Input data sanitized and rendered via compliant React DOM and `marked` parsers.
