# ADR-0014: LaTeX SyncTeX Bidirectional Mapping (Left <-> Right Navigation)

- **Status**: Accepted
- **Date**: 2026-10-25
- **Deciders**: Core Development Team & AI Assistant

---

## Context
When authoring LaTeX documents in modern environments like Overleaf, users need immediate bidirectional traceability between LaTeX source code (left pane) and compiled PDF output (right pane):
1. **Left to Right (Source to PDF / Forward Sync)**: The user places the cursor at a line in the LaTeX source and clicks the right arrow (`->`) to scroll the PDF viewer directly to the corresponding page and position, highlighting the generated text with an animated highlight box.
2. **Right to Left (PDF to Source / Reverse Sync)**: The user clicks on text in the PDF preview (placing an interactive location pin) and clicks the left arrow (`<-`) (or double-clicks) to move the editing cursor to the exact source file and line number in the code editor.

Prior to this work, DocForge compiled documents with standard batch flags without generating synchronization metadata, and rendered PDFs via standard browser `iframe` elements, preventing coordinate-level interaction and visual highlighting.

---

## Decision

1. **TeX Live SyncTeX Generation**:
   - Updated LaTeX compilation passes (`pdflatex`, `xelatex`, `lualatex`) in `src/backend/src/latexCompiler.ts` to include `-synctex=1`.
   - Persisted compressed synchronization data (`output.synctex.gz`) into MySQL table `latex_compilations.synctex_data` (`LONGBLOB`).
   - Maintained a high-performance local workspace cache in `/tmp/latex_synctex_cache/${projectId}` for sub-millisecond CLI synchronization queries.

2. **Backend SyncTeX Services**:
   - Implemented `runSynctexView` (`synctex view -i line:col:input -o output.pdf`) returning target page and bounding box `{ page, x, y, h, v, width, height }`.
   - Implemented `runSynctexEdit` (`synctex edit -o page:x:y:output.pdf`) resolving matched source file path, document ID, line number, and column.
   - Exposed endpoints:
     - `POST /api/v1/documents/:id/latex/sync/source-to-pdf`
     - `POST /api/v1/documents/:id/latex/sync/pdf-to-source`

3. **Frontend PDF.js Viewer & Overleaf Navigation Controls**:
   - Integrated `pdfjs-dist` (v3.11.174) with `LatexPdfViewer.tsx` for high-fidelity canvas rendering, DPI scaling, and page overlays.
   - Added interactive click detection on PDF page overlays converting click coordinates back to 72 DPI PDF points with visual marker pin display.
   - Built the iconic Overleaf-style central divider toolbar between the editor and PDF preview featuring:
     - **Right Arrow (`->`)**: Source to PDF jump with animated amber pulse highlight box.
     - **Left Arrow (`<-`)**: PDF to Source jump with line number highlighting and cursor repositioning.
   - Added keyboard shortcuts:
     - `Ctrl+Alt+Right` / `Cmd+Alt+Right`: Jump to PDF
     - `Ctrl+Alt+Left` / `Cmd+Alt+Left`: Jump to Source
     - Double-clicking text in PDF viewer triggers immediate reverse synchronization.

---

## Consequences

### Positive
- Delivers complete parity with Overleaf's source-to-PDF and PDF-to-source tracing and editing workflow.
- Supports multi-file LaTeX projects, automatically switching active editor tabs when jumping from PDF text to included `.tex` chapters.
- Fully compatible with containerized deployments and offline environments without external CDN dependencies.

### Negative / Trade-offs
- Compiling with `-synctex=1` slightly increases disk usage per compilation by generating compressed `.synctex.gz` records (typically 10-50 KB).
- PDF.js bundle size added to frontend build (~1 MB worker asset, lazily loaded by browser).
