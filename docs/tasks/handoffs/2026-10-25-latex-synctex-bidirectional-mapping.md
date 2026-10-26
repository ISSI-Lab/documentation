# Session & Machine Handoff: LaTeX SyncTeX Bidirectional Mapping (Left <-> Right)

- **Date**: 2026-10-25
- **Author**: AI Assistant
- **Branch**: `main`
- **Machine**: Linux Development Environment

---

## 1. What Was Completed
- **SyncTeX TeX Live Compiler Integration**:
  - Enabled `-synctex=1` in `compileLatexProject` (`src/backend/src/latexCompiler.ts`).
  - Added `synctex_data LONGBLOB NULL` column to `latex_compilations` table in `init.sql` and `db.ts`.
  - Stored synchronization data (`output.synctex.gz`) in MySQL and disk cache.
- **SyncTeX CLI Query Utilities & Endpoints**:
  - Implemented `runSynctexView` (source to PDF) and `runSynctexEdit` (PDF to source) with path resolution.
  - Added endpoints in `src/backend/src/routes/latexRoutes.ts`:
    - `POST /api/v1/documents/:id/latex/sync/source-to-pdf`
    - `POST /api/v1/documents/:id/latex/sync/pdf-to-source`
- **Interactive PDF Viewer with PDF.js**:
  - Built `LatexPdfViewer.tsx` (`src/frontend/src/components/documents/latex/LatexPdfViewer.tsx`) supporting canvas rendering, page overlays, click coordinates in 72 DPI, target marker pin, and animated amber pulse highlight box.
- **Overleaf-style Central Mapping Bar & Editor Controls**:
  - Added central divider bar with Right Arrow (`->`, `synctex-source-to-pdf-btn`) and Left Arrow (`<-`, `synctex-pdf-to-source-btn`) in `LatexDocumentEditor.tsx`.
  - Added quick sync action buttons in editor toolbar and PDF preview toolbar.
  - Added keyboard shortcuts (`Ctrl+Alt+Right` / `Cmd+Alt+Right` for Source -> PDF, `Ctrl+Alt+Left` / `Cmd+Alt+Left` for PDF -> Source) and PDF double-click trigger.
  - Implemented cursor line tracking and line number highlighting in editor.
- **Multi-File LaTeX Navigation**:
  - Verified that reverse sync across multi-file documents automatically switches to the correct included `.tex` file and centers the cursor at the matching line.
- **ADR-0014**:
  - Documented decision and architecture in [`docs/memory/decisions/0014-latex-synctex-bidirectional-mapping.md`](../../memory/decisions/0014-latex-synctex-bidirectional-mapping.md).

## 2. Work in Progress (Unfinished State)
- None. Full bidirectional mapping (Left -> Right and Right -> Left) is complete and tested.

## 3. Verification & Testing Status
- Ran automated end-to-end integration tests verifying:
  - Single-file forward sync (Source Line 4 and 6 -> PDF page 1, coordinates, and bounding box).
  - Single-file reverse sync (PDF coordinates -> Source file `main.tex`, Line 4 and Line 6).
  - Multi-file reverse sync (PDF coordinates -> included chapter file `chapter1.tex`, doc ID, and Line 1).
- Ran TypeScript compilation and Vite production build in Docker (`tsc && vite build`), exiting with code 0.
- Rebuilt and validated live Docker containers with `./scripts/start.sh --prod -b`.
- Ran `python3 agent_tool/validate_docs.py`, all links and docs validated.

## 4. Known Blockers & Notes
- None.

## 5. Immediate Next Steps
1. Test in browser UI by creating or editing a LaTeX document, clicking on text in the PDF and pressing `<-`, or clicking in the editor and pressing `->`.
