# ADR-0010: Grouped Iteration Elements with Predefined Keys per Iteration

- **Status**: Accepted
- **Date**: 2026-10-04
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
In our template-driven document authoring engine, documents often require iterative tracking workflows—such as debugging investigations, agile iteration cycles, root-cause analyses, or risk assessments.
Previously:
1. Dynamic lists (`interactive_list` / `repeatable_list`) only allowed adding single items, where each item was an individual `description - value` pair.
2. Users requested a structured grouping mechanism where each iteration (Iteration #1, Iteration #2, ... Iteration #N) contains a **group of items** (for example: Reason, Todo, Response).
3. In this model, the **template creator** must specify how many key-value list items are included in each iteration (e.g., 3 items: `Reason`, `Todo`, and `Response`), and define the **fixed key names**.
4. The keys must **not** be filled or renamed by the document writer; the document writer only edits the **values** for those predefined keys, and adds/removes whole iterations dynamically.

## Decision
We redesigned the iteration element mechanism to introduce **Grouped Iteration Elements (`iteration_group`)** with template-configured fixed keys:

1. **Configured Iteration Fields Schema (`IterationFieldConfig`)**:
   - Added `iteration_fields?: IterationFieldConfig[]` to `DocumentElementConfig`.
   - Each `IterationFieldConfig` defines a fixed key (e.g. `Reason`, `Todo`, `Response`), with optional guidance `description`, `placeholder`, and `default_value`.
   - Template creators can add, reorder, edit key names, or choose from quick presets (Standard: `Reason`, `Todo`, `Response`; Four-Step: `Observation`, `Hypothesis`, `Action`, `Outcome`).

2. **Iteration Group Data Model (`IterationGroupItem`)**:
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
   - In `DocumentEditor` and `ParticipantSubmissionWorkspace`, document writers can click `+ Add Iteration (Iteration #N)` to add a new cycle pre-populated with all the template-defined keys.
   - Fixed keys are rendered as non-editable labels/badges, ensuring template integrity across document authors.

3. **Deterministic Markdown Compilation**:
   - In `compiler.ts` and live split preview, each iteration compiles to:
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

4. **Backwards Compatibility**:
   - Legacy `repeatable_list` and `interactive_list` without `iteration_fields` remain supported as single-item repeatable lists.
   - If `iteration_fields` is present on any repeatable list, it automatically upgrades to grouped iteration rendering and compilation.

## Consequences

### Positive
- **Structured Grouped Iterations**: Authors and reviewers get a clean, standardized format for cycles of reasoning (Reason -> Todo -> Response).
- **Template Creator Governance**: Fixed keys ensure consistency across all documents generated from the template; writers cannot accidentally alter field labels.
- **Dynamic Flexibility**: Document writers can create as many iterations as needed (`Iteration #1`, `#2`, `#N`) on the fly.
- **Clean Markdown Output**: Produces clean, readable Markdown outlines with proper hierarchical headings and list formatting.

### Negative / Trade-offs
- Requires template authors to specify `iteration_fields` when creating grouped iteration elements. Mitigated by sensible defaults (`Reason`, `Todo`, `Response`) and instant preset buttons.
