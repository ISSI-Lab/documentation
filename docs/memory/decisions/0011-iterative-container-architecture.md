# ADR-0011: Iterative Container Architecture

- **Status**: Accepted
- **Date**: 2026-10-04
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
In our template-driven document system, iterative elements are used to track repetitive engineering or analysis cycles (such as bug root-cause investigations, sprint retrospectives, mitigation steps, or incident timelines).

Previously:
1. Iterative elements were restricted to flat arrays of single items or fixed key-value tuples.
2. In practice, real-world iterative sections require heterogeneous components within each iteration cycle:
   - **Key-Value Items**: A fixed key label (defined and locked by the template editor) paired with an editable value (filled in by the document writer).
   - **Markdown Text**: An editable, rich Markdown block for longer-form notes, justifications, or dynamic snippets.
   - **Markdown Read-Only**: View-only instructional Markdown text (e.g. guidance, checklists, criteria, policy reminders) configured by the template editor that writers view but cannot edit or delete.
3. When writing a document, adding an iteration cycle must add **the entire group of elements defined in the container as a complete unit** (`Iteration #1`, `Iteration #2`, ... `Iteration #N`), rather than piecemeal item-by-item additions.

## Decision
We introduced the **Iterative Container (`iteration_container`)** paradigm across the entire stack (TypeScript frontend, Python/Node.js backend models, compiler, and storage).

### 1. Data Schema & Models
- **`ContainerChildType`**: `'key_value' | 'markdown_text' | 'markdown_readonly'`.
- **`ContainerChildElement`**:
  ```typescript
  export interface ContainerChildElement {
    id: string;
    type: ContainerChildType;
    key?: string;           // Predefined key label (for key_value)
    label?: string;         // Display label or title
    description?: string;   // Authoring instructions / help text
    placeholder?: string;   // Input placeholder text
    content?: string;       // Pure markdown content (for markdown_readonly)
    default_value?: string; // Pre-filled default value
  }
  ```
- **`DocumentElementConfig`**: Extended with `container_children?: ContainerChildElement[] | null`.
- Synchronized models in `src/frontend/src/types/index.ts`, `src/backend/src/models.ts`, and `src/backend/app/models.py`.

### 2. Template Authoring Experience
In [`TemplateBuilder.tsx`](../../../src/frontend/src/components/templates/TemplateBuilder.tsx):
- Template creators can add an **Iterative Container (`iteration_container`)** element.
- Creators can add, reorder, edit, and delete any combination of child elements:
  - **Key-Value**: Template creator defines the fixed `key` label (e.g., `Reason`, `Todo`, `Response`).
  - **Markdown Text**: Template creator defines section heading, placeholder, and guidance for writer Markdown inputs.
  - **Markdown Read-Only**: Template creator provides view-only guidelines, reference tables, or checklists.
- Quick Presets available:
  - Standard (Reason, Todo, Response)
  - 4-Step Plan (Objective, Action Items, Dependencies, Expected Result)
  - Guided Cycle (Instructions + Issue Description + Fix Details + Outcome)

### 3. Document Writer Experience
In [`DocumentEditor.tsx`](../../../src/frontend/src/components/documents/DocumentEditor.tsx) and [`ParticipantSubmissionWorkspace.tsx`](../../../src/frontend/src/components/documents/ParticipantSubmissionWorkspace.tsx):
- **Whole-Group Addition**: Document writers click `+ Add Iteration #N (Whole Group: ...)`. The entire group of child elements defined in the container is instantiated as a cohesive cycle.
- **Key Display & Value Editing**: In key-value items, the fixed key label is displayed prominently (e.g., `Reason:`) and cannot be modified by the writer; the input/textarea allows editing only the value.
- **Read-Only Rendering**: Template read-only Markdown blocks render as styled view-only guidance boxes.
- **Editable Markdown Blocks**: Rendered with dedicated textareas and styling for author narrative.

### 4. Deterministic Markdown Compilation
In [`compiler.ts`](../../../src/backend/src/compiler.ts) and live preview:
- Each iteration renders under a sub-heading (e.g. `### Iteration #1`).
- `markdown_readonly` children emit their markdown content directly.
- `markdown_text` children emit a sub-heading (if labeled) followed by writer text.
- `key_value` children emit `- **{Key}:** {Value}` bullet points with proper two-space indentation for multi-line content.

### 5. Backward Compatibility & Normalization
Shared helper [`iterationUtils.ts`](../../../src/frontend/src/utils/iterationUtils.ts):
- Normalizes legacy `iteration_fields` and legacy flat lists into container child structures seamlessly.
- Automatically handles fallback to default `Reason`, `Todo`, `Response` if older templates lack explicit child configurations.

## Consequences

### Positive
- **Cohesive Iteration Cycles**: Eliminates fractional or broken iterations; document writers always add a complete set of elements.
- **Separation of Authoring Responsibilities**: Template authors control the structure, fixed keys, and reference guidelines; document writers focus purely on providing responses and adding iteration cycles.
- **Heterogeneous Content Support**: Containers are not restricted to simple key-values; they comfortably house instructions, long-form Markdown, and structured fields.
- **Full Backward Compatibility**: Existing documents and legacy templates remain functional and compile identically without data migration scripts.

### Negative / Trade-offs
- Container children must be managed within the template builder UI, requiring clear hierarchy controls.
- Child elements cannot be dynamically added or removed by document writers within an individual iteration instance; structure changes must be made at the template level.
