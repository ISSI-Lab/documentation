import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { SynctexPdfLocation } from '../../../types';
import { ZoomIn, ZoomOut, Maximize2, Crosshair, ArrowLeft, RefreshCw, Check } from 'lucide-react';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface PdfClickPoint {
  page: number;
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
}

interface LatexPdfViewerProps {
  pdfUrl: string;
  highlightTarget?: SynctexPdfLocation | null;
  onPdfClick?: (point: PdfClickPoint) => void;
  onPdfDoubleClick?: (point: PdfClickPoint) => void;
  onSyncToSource?: () => void;
  selectedPoint?: PdfClickPoint | null;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
}

export const LatexPdfViewer: React.FC<LatexPdfViewerProps> = ({
  pdfUrl,
  highlightTarget,
  onPdfClick,
  onPdfDoubleClick,
  onSyncToSource,
  selectedPoint,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [pagesData, setPagesData] = useState<PageData[]>([]);
  const pdfDocRef = useRef<any>(null);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });
        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        const pages: PageData[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          pages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (!isCancelled) {
          setPagesData(pages);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF via PDF.js:', err);
          setError(err.message || 'Failed to render PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // Render individual page canvases
  const renderPage = useCallback(
    async (pageIndex: number) => {
      const doc = pdfDocRef.current;
      if (!doc) return;

      const canvas = canvasRefs.current[pageIndex];
      if (!canvas) return;

      try {
        const page = await doc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err: any) {
        // Cancelled or rerendered
      }
    },
    [scale]
  );

  // Trigger page renders when pagesData or scale changes
  useEffect(() => {
    if (!loading && pagesData.length > 0) {
      pagesData.forEach((_, idx) => {
        renderPage(idx);
      });
    }
  }, [loading, pagesData, scale, renderPage]);

  // Handle forward SyncTeX highlight scrolling
  useEffect(() => {
    if (!highlightTarget || !containerRef.current) return;

    const pageIndex = highlightTarget.page - 1;
    const pageEl = pageRefs.current[pageIndex];
    if (!pageEl) return;

    // Calculate vertical offset relative to container
    const pageTop = pageEl.offsetTop;
    const highlightY = highlightTarget.v * scale;
    const targetScrollY = Math.max(0, pageTop + highlightY - 150);

    containerRef.current.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  }, [highlightTarget, scale]);

  // Handle click on a page interaction overlay
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert from rendered CSS pixels back to standard PDF points (72 DPI)
    const pdfX = clickX / scale;
    const pdfY = clickY / scale;

    const point: PdfClickPoint = {
      page: pageNum,
      x: pdfX,
      y: pdfY,
      canvasX: clickX,
      canvasY: clickY,
    };

    onPdfClick?.(point);
  };

  const handlePageDoubleClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const pdfX = clickX / scale;
    const pdfY = clickY / scale;

    const point: PdfClickPoint = {
      page: pageNum,
      x: pdfX,
      y: pdfY,
      canvasX: clickX,
      canvasY: clickY,
    };

    onPdfDoubleClick?.(point);
  };

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(3.0, +(s + 0.15).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)));
  const fitWidth = () => {
    if (!containerRef.current || pagesData.length === 0) return;
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    const firstPageWidth = pagesData[0].width;
    if (firstPageWidth > 0) {
      const newScale = containerWidth / firstPageWidth;
      setScale(Math.max(0.5, Math.min(2.5, +newScale.toFixed(2))));
    }
  };
  const resetZoom = () => setScale(1.0);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-200/90 overflow-hidden relative select-none">
      {/* Viewer Floating Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/95 border-b border-slate-300 z-10 text-xs shadow-sm">
        {/* Left: Page count & sync hint */}
        <div className="flex items-center space-x-2 text-slate-700">
          <span className="font-semibold" data-testid="pdf-page-count">
            {pagesData.length > 0 ? `${pagesData.length} ${pagesData.length === 1 ? 'Page' : 'Pages'}` : 'PDF'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Click text &amp; click <strong>&#x25C0;</strong> (or double click) to jump to source
          </span>
        </div>

        {/* Right: Sync action & Zoom buttons */}
        <div className="flex items-center space-x-1.5">
          {onSyncToSource && selectedPoint && (
            <button
              onClick={onSyncToSource}
              data-testid="pdf-toolbar-sync-to-source-btn"
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm transition-colors mr-2 animate-pulse"
              title="Jump cursor to corresponding LaTeX source code"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Jump to Source</span>
            </button>
          )}

          <div className="flex items-center bg-white border border-slate-300 rounded shadow-sm px-1 py-0.5 space-x-1">
            <button
              onClick={zoomOut}
              className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetZoom}
              className="px-1.5 py-0.5 text-[11px] font-mono text-slate-700 hover:bg-slate-100 rounded"
              title="Reset Zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitWidth}
              className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded ml-0.5"
              title="Fit Page Width"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Pages Scroll Container */}
      <div
        ref={containerRef}
        data-testid="pdf-pages-scroll-container"
        className="flex-1 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center space-y-6"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm font-semibold">Rendering PDF pages...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white border border-rose-200 rounded max-w-md my-10">
            <p className="text-sm font-bold text-rose-600 mb-2">Unable to display PDF with canvas viewer</p>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <iframe src={pdfUrl} className="w-full h-96 border border-slate-300 rounded" title="Fallback PDF" />
          </div>
        ) : (
          pagesData.map((page, idx) => {
            const isTargetPage = highlightTarget?.page === page.pageNumber;
            const isClickPage = selectedPoint?.page === page.pageNumber;

            return (
              <div
                key={page.pageNumber}
                ref={(el) => (pageRefs.current[idx] = el)}
                data-testid={`pdf-page-${page.pageNumber}`}
                className="relative bg-white shadow-lg border border-slate-300 transition-all rounded-xs"
                style={{
                  width: `${page.width * scale}px`,
                  height: `${page.height * scale}px`,
                }}
              >
                {/* PDF Canvas */}
                <canvas
                  ref={(el) => (canvasRefs.current[idx] = el)}
                  className="block w-full h-full"
                />

                {/* Interactive Click & SyncTeX Overlay */}
                <div
                  onClick={(e) => handlePageClick(e, page.pageNumber)}
                  onDoubleClick={(e) => handlePageDoubleClick(e, page.pageNumber)}
                  data-testid={`pdf-page-overlay-${page.pageNumber}`}
                  className="absolute inset-0 cursor-crosshair z-20"
                  title="Click to select text position; Click ← to jump to source code"
                >
                  {/* Selected Click Pin / Marker */}
                  {isClickPage && selectedPoint && (
                    <div
                      data-testid="pdf-selected-point-marker"
                      className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-30 transition-transform"
                      style={{
                        left: `${selectedPoint.x * scale}px`,
                        top: `${selectedPoint.y * scale}px`,
                      }}
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-5 h-5 rounded-full bg-indigo-500/30 animate-ping" />
                        <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-md flex items-center justify-center" />
                        <span className="absolute left-4 px-1.5 py-0.5 text-[10px] font-bold bg-slate-900/90 text-white rounded whitespace-nowrap shadow-sm pointer-events-none">
                          PDF ({Math.round(selectedPoint.x)}, {Math.round(selectedPoint.y)})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Forward SyncTeX Highlight Box (Source -> PDF) */}
                  {isTargetPage && highlightTarget && (
                    <div
                      data-testid="synctex-highlight-box"
                      className="absolute pointer-events-none z-30 bg-amber-400/40 border-2 border-amber-500 rounded ring-4 ring-amber-400/30 transition-all duration-300 animate-pulse"
                      style={{
                        left: `${highlightTarget.h * scale}px`,
                        top: `${highlightTarget.v * scale}px`,
                        width: `${Math.max(highlightTarget.width * scale, 40)}px`,
                        height: `${Math.max(highlightTarget.height * scale, 16)}px`,
                      }}
                    >
                      <div className="absolute -top-5 left-0 px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded shadow-sm whitespace-nowrap">
                        Line Highlight
                      </div>
                    </div>
                  )}
                </div>

                {/* Page Number Badge */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] bg-slate-800/60 text-white rounded font-mono select-none pointer-events-none">
                  Page {page.pageNumber}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
