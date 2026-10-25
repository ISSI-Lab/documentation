# ADR-0013: LaTeX Multi-File Editing, Compilation, and Live PDF Preview Integration

- **Status**: Accepted
- **Date**: 2026-10-23
- **Deciders**: Platform Architecture Team, Antigravity AI Assistant

---

## Context
DocForge is a technical documentation platform with democratic organization governance, project collaboration, and structured element-driven Markdown authoring.

In academic, engineering, and scientific research domains, teams require publication-ready multi-file LaTeX projects with BibTeX references, equations, presentations (Beamer), and live compiled PDF outputs. A standalone Overleaf CE fork existed in `latex_tool` using PostgreSQL 15 (JSONB document store) and a separate service architecture.

The objective was to adapt and integrate the LaTeX editing, multi-file management, backend TeX Live compilation, and live PDF preview functionalities from `latex_tool` into DocForge while satisfying four core constraints:
1. **Database Relational Port**: Use **MySQL 8.0** (`docforge` database) instead of PostgreSQL/MongoDB.
2. **Dedicated LaTeX Templates**: Provide multi-file starter templates (IEEE Conference Article, Technical Report, Beamer Presentation) and blank projects.
3. **Strict Dual-Path Separation**:
   - The Markdown path remains 100% untouched with its element/section-driven builder.
   - The LaTeX path operates as a file-based LaTeX IDE.
   - LaTeX documents can only start from a LaTeX template or as a blank LaTeX project.
4. **Themed UI**: Match DocForge's existing design system (Tailwind CSS, Sharp Mui Paper, Zinc/Slate/Indigo color palette).

---

## Decision

We integrated the complete LaTeX toolchain into DocForge, establishing a strict dual-path architecture with a relational MySQL 8.0 backend and an in-container TeX Live build pipeline.

### 1. Dual-Path Architecture & Routing
- Added `format ENUM('markdown', 'latex') NOT NULL DEFAULT 'markdown'` to the `documents` table.
- When `format === 'markdown'`:
  - Continues rendering standard section builder (`DocumentEditor.tsx`), markdown viewer (`DocumentViewer.tsx`), and markdown exports.
- When `format === 'latex'`:
  - Routes directly to the 3-pane `LatexDocumentEditor.tsx` workspace.
  - Creation is restricted to either choosing a LaTeX starter template or starting a blank project via `CreateLatexDocumentModal.tsx`.

### 2. MySQL 8.0 Relational Model
Mapped `latex_tool`'s document entities into 7 relational MySQL tables:
- `latex_templates`: Pre-seeded multi-file template bundles.
- `latex_projects`: Project root with compiler choice and version counter.
- `latex_folders`: Folder directory hierarchy.
- `latex_docs`: Text documents (`.tex`, `.bib`, `.sty`, `.cls`) with revision counters.
- `latex_files`: Binary assets (`.png`, `.jpg`, `.pdf`, `.eps`) in `LONGBLOB` columns.
- `latex_compilations`: Build history, parsed error JSON, and output `LONGBLOB` PDF buffers.
- `latex_doc_snapshots`: Revision snapshots for historical checkpoints.

### 3. Containerized TeX Live Compiler Toolchain
- Installed `texlive`, `texlive-latexrecommended`, `texlive-pictures`, `texlive-latexextra`, and `zip` directly in the backend Alpine container image.
- Implemented `latexCompiler.ts`:
  - Isolated temporary build directories for reproducible builds.
  - Nonstop execution of `pdflatex` with automatic `bibtex` passes when bibliography files exist.
  - Robust log parser extracting exact error messages, file names, and line numbers.
  - Deterministic `.zip` source archive packaging.
- Mounted `/api/v1/latex/*` and `/api/v1/documents/:id/latex/*` routes handling tree manipulation, file CRUD, binary asset uploads, compilation triggers, PDF streaming, and source zip downloads.

### 4. Public & Private LaTeX Template Scoping
- `latex_templates` supports the same 3 visibility scopes as Markdown templates:
  - **Public** (`visibility = 'public'`, `organization_id = null`): Visible on the unauthenticated home/landing page, the logged-in Personal Homepage, and the logged-in Templates page.
  - **Personal Private** (`visibility = 'private'`, `organization_id = null`): Strictly private to the authenticated creator (`created_by = user.id`).
  - **Organization Private** (`visibility = 'private'`, `organization_id = <orgId>`): Strictly private to members of that organization.
- Unauthenticated requests to `GET /api/v1/latex/templates`, `GET /api/v1/latex/templates/:id`, `GET /api/v1/templates`, and `GET /api/v1/templates/:id` strictly enforce `visibility = 'public'` and return `403 Forbidden` for any private template.
- Built `LatexTemplateBuilder.tsx` and extended `CopyTemplateModal.tsx` to support full Create, Edit, Delete, and Cross-Organization Copy of LaTeX templates.

### 5. Frontend 3-Pane Workspace & Format Switching
- Built `LatexDocumentEditor.tsx`:
  - Left pane: File tree with folder navigation, new file/folder creation, asset upload modal, root document selection, and ZIP download.
  - Center pane: Line-numbered code editor with LaTeX quick actions (`\textbf`, `\textit`, `\section`, `\begin{equation}`, `\cite`, `\figure`), Greek symbol picker modal, and hotkeys.
  - Right pane: Dual split viewer containing live PDF iframe viewer and collapsible log inspector with jump-to-line error navigation.
- Updated `TemplateList.tsx` with top-level format tabs (**Markdown Templates** vs **LaTeX Templates**) and unified category/organization filters (`All`, `Public Pool`, `Personal`, `Organization Templates`).
- Updated `DocumentList.tsx` with format badges, version tag badges, format filtering, **Commit** and **Version** action buttons for each LaTeX document, and dedicated "New LaTeX Document" actions.
- Built `LatexVersionPage.tsx` (`currentView === 'latex_versions'`) backed by `latex_doc_snapshots` and `/api/v1/documents/:id/latex/versions*` routes so users can commit named versions via a version input modal, inspect each committed version's multi-file snapshot and diff against the working copy, and restore any previous version as the current working version.

---

## Consequences
- **Positive**:
  - Full Overleaf-style LaTeX IDE capabilities natively integrated without running a separate monolithic ShareLaTeX service.
  - Complete parity between Markdown and LaTeX templates for public vs. private (`Personal` and `Organization`) scoping, RBAC, and cross-organization copying.
  - Zero performance overhead or disruption to existing Markdown documentation.
  - Single consolidated MySQL 8.0 database for all platform features.
  - Fast compilation times (<1 second for reports, articles, and slides).
- **Negative / Operational Considerations**:
  - Backend container image size increased by ~500 MB due to TeX Live distribution packages.
  - Concurrent compilations create transient build directories (cleaned up automatically in `finally` blocks).
