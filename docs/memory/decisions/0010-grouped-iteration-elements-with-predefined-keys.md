# ADR-0010: Grouped Iteration Elements with Predefined Keys per Iteration

- **Status**: Accepted
- **Date**: 2026-10-04
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
In our template-driven document authoring engine, documents often require iterative tracking workflows—such as debugging investigations, agile iteration cycles, root-cause analyses, or risk assessments.
Previously:
1. Dynamic lists (`interactive_list` / `repeatable_list`) only allowed adding single items, where each item was an individual `description - value` pair added one by one.
2. Users requested a structured grouping mechanism where each iteration (Iteration #1, Iteration #2, ... Iteration #N) contains a **group of items** (for example: Reason, Todo, Response).
3. When editing a document containing iterative elements, document writers must **only add the entire whole list** (containing all key-value items defined in the template) together as an iteration cycle—**not** one key-value item by one key-value item.
4. The **template creator** specifies how many key-value list items are included in each iteration (e.g., 3 items: `Reason`, `Todo`, and `Response`), and defines the **fixed key names**.
5. The keys must **not** be filled or renamed by the document writer; the document writer only edits the **values** for those predefined keys, and adds/removes whole iterations dynamically.

## Decision
We redesigned the iteration element mechanism across frontend and backend to enforce **Grouped Iteration Elements** with template-configured fixed keys and whole-list iteration addition:

1. **Configured Iteration Fields Schema (`IterationFieldConfig`)**:
   - Added `iteration_fields?: IterationFieldConfig[]` to `DocumentElementConfig`.
   - Each `IterationFieldConfig` defines a fixed key (e.g. `Reason`, `Todo`, `Response`), with optional guidance `description`, `placeholder`, and `default_value`.
   - Template creators can add, reorder, edit key names, or choose from quick presets (Standard: `Reason`, `Todo`, `Response`; Four-Step: `Observation`, `Hypothesis`, `Action`, `Outcome`).

2. **Iteration Group Data Model & Whole-List Addition (`IterationGroupItem`)**:
   - Each iteration in the document is stored in the element's array:
     ```typescript
     export interface IterationGroupItem {
       id: string; // e.g. "iter-1"
       iteration_number?: number; // 1, 2, ...
       title?: string; // "Iteration #1"
       values: Record<string, string>; // { "Reason": "...", "Todo": "...", "Response": "..." }
       fields?: Array<{ key: string; value: string }>;
     }
     ```
   - In [`DocumentEditor.tsx`](../../../src/frontend/src/components/documents/DocumentEditor.tsx) and [`ParticipantSubmissionWorkspace.tsx`](../../../src/frontend/src/components/documents/ParticipantSubmissionWorkspace.tsx), document writers click `+ Add Iteration #N (Whole List: {keys.join(', ')})` to append a new cycle pre-populated with the **entire list** of template-defined keys.
   - Fixed keys are rendered as non-editable labels/badges, ensuring template integrity across document authors.
   - **Elimination of Single-Item Addition**: The legacy single-item addition ("Add New Editable Element (Description - Value)") has been completely removed. Document writers cannot add single key-values one by one; they can only add the whole list configured in the template.

3. **Deterministic Markdown Compilation**:
   - In [`compiler.ts`](../../../src/backend/src/compiler.ts) and live split preview, each iteration compiles to:
     ```markdown
     ### Iteration #1
     - **Reason:** {value}
     - **Todo:** {value}
     - **Response:** {value}

     ### Iteration #2
     - **Reason:** {value}
     - **Todo:** {value}
     - **Response:** {value}
     ```
   - Multiline values are indented with two spaces to maintain clean GitHub/GitLab markdown parsing.

4. **Unified Backward Compatibility & Normalization**:
   - Shared utility [`iterationUtils.ts`](../../../src/frontend/src/utils/iterationUtils.ts) normalizes all iterative element types (`iteration_group`, `interactive_list`, `repeatable_list`).
   - If an existing document contains legacy flat items, they are automatically normalized into `Iteration #1` containing the extracted keys, preventing fallback to single-item mode.

## Consequences

### Positive
- **Whole-List Consistency**: Document writers append entire iteration cycles with all template keys as a single cohesive unit, eliminating incomplete or mismatched single key-value entries.
- **Template Creator Governance**: Fixed keys ensure consistency across all documents generated from the template; writers cannot accidentally alter field labels.
- **Dynamic Flexibility**: Document writers can create as many iterations as needed (`Iteration #1`, `#2`, `#N`) on the fly.
- **Clean Markdown Output**: Produces clean, readable Markdown outlines with proper hierarchical headings and list formatting.

### Negative / Trade-offs
- Template authors define the fixed keys for the iterations. If a template omitted `iteration_fields`, the system uses fallback standard keys (`Reason`, `Todo`, `Response`).
