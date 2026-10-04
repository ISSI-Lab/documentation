# ADR-0009: Pure Markdown View-Only and Iterative Editable Document Elements

- **Status**: Accepted
- **Date**: 2026-10-04
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
In our template-driven document authoring engine, document elements define the structure and content of documents. Previously:
1. All elements were rendered as editable form inputs (such as markdown textareas, text inputs, or selects). There was no mechanism for template authors to provide pure markdown text strictly for viewing (such as specification guidelines, background context, rubric standards, or reference documentation) that document writers could read without accidentally modifying or deleting.
2. Dynamic sections (such as considered architectural options or risk assessments) required a structured model where each editable entry is clearly defined as a `description - value` pair, where the key is the description and the value is the editable input.
3. Users required support for both single interactive elements (with a description portion and an input part) and iterative arrays of editable elements (lists of input elements, each following the description-value structure).

## Decision
We adopted a unified model for **Pure Markdown View-Only Elements** and **Iterative Editable Elements**:

1. **Pure Markdown Text Element Part (Only for Viewing)**:
   - Added `view_markdown` property to `DocumentElementConfig`: allows any document element to include a pure markdown text part rendered strictly for viewing above the input area.
   - Added dedicated `pure_markdown` element type: an entire section that contains pure markdown text strictly for viewing. In `DocumentEditor` and `ParticipantSubmissionWorkspace`, it renders as formatted markdown without any editing textarea.
   - In `compiler.ts`, `view_markdown` and `pure_markdown` are emitted deterministically into the compiled document markdown.

2. **Iterative / Interactive Element (Description & Input Part)**:
   - Added `interactive_field` element type: contains a portion where description is placed (the key/label) and an input (editing) part for author response.
   - Can optionally include a pure markdown viewing part above it for context.

3. **Iterative Array of Editable Elements (Description - Value Pairs)**:
   - Enhanced `interactive_list` and `repeatable_list` to represent an iterative array of editable elements.
   - Each editable element in the array is structured as a `description - value` pair:
     - **Key**: `description` (identifies the item/field).
     - **Value**: `value` (the editable response / markdown).
   - Document authors can edit the value, customize or view the description key, add new items dynamically via `+ Add New Editable Element`, and delete items.
   - Maintained full backwards compatibility with legacy `title` (maps to `description`) and `content` (maps to `value`).

4. **Full-Stack Integration**:
   - **Backend Models & Sanitization** (`src/backend/src/models.ts`, `routes/templates.ts`, `routes/documents.ts`): Type definitions and CRUD routes preserve `view_markdown` and normalize `description` and `value` arrays.
   - **Markdown Compiler** (`src/backend/src/compiler.ts`): Emits pure markdown text, single interactive fields, and iterative lists with `### {description}\n\n{value}` sub-sections.
   - **Frontend Document Editor** (`DocumentEditor.tsx`): Renders view-only markdown blocks, interactive fields with description and input parts, iterative arrays with description-value pairs, and live split view compilation.
   - **Participant Submission Workspace** (`ParticipantSubmissionWorkspace.tsx`): Displays pure markdown viewing content and enables participants to edit description-value elements.
   - **Template Builder** (`TemplateBuilder.tsx`): Enables template designers to configure pure markdown view-only text, interactive fields, and iterative arrays of description-value elements with real-time outline preview.

## Consequences

### Positive
- **Clear Separation of Viewing vs Editing**: Authors can inspect background guidelines and specifications without risk of accidental mutation.
- **Structured Description-Value Data Model**: Iterative arrays have explicit keys (`description`) and editable inputs (`value`), standardizing document sections across teams.
- **Complete Backwards Compatibility**: Existing templates and saved documents continue to load, edit, and compile without database migration breakage.

### Negative / Trade-offs
- Template schemas support more element variants, requiring comprehensive validation and preview formatting in both frontend and backend.
