import React, { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "./pdfWorker";
import { getPdfAsync } from "./authenticatedFetch";
import { buildCharMap, rectsForRange } from "./lib/pdfTextIndex";
import type {
  HighlightInstruction,
  HighlightRect,
  CharBox,
  OutlineItem
} from "./types";

interface PdfViewerProps {
  fileName: string | null;
  citations: HighlightInstruction[];
  activeCitationId: string | null;
  highlightColor: string;
  onCreateHighlight?: (h: HighlightInstruction) -> void;
  onOutlineLoaded?: (outline: OutlineItem[]) -> void;
}

interface SelectionRectPageCoords {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileName,
  citations,
  activeCitationId,
  highlightColor,
  onCreateHighlight,
  onOutlineLoaded
}) => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [rects, setRects] = useState<HighlightRect[]>([]);
  const [status, setStatus] = useState<string>("Idle");

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const charMapCacheRef = useRef<Map<number, CharBox[]>>(new Map());

  const scale = 1.35;

  // Load / cache PDF by fileName
  useEffect(() => {
    let cancelled = false;
    const abortCtrl = new AbortController();

    (async () => {
      if (!fileName) {
        setPdfDoc(null);
        setNumPages(0);
        setLoadedFile(null);
        setRects([]);
        setStatus("No file selected");
        return;
      }

      if (pdfDoc && loadedFile === fileName) {
        setStatus(`Loaded ${fileName} (${numPages} pages)`);
        return;
      }

      try {
        setStatus("Loading PDF...");
        const data = await getPdfAsync(fileName, abortCtrl.signal);
        const loadingTask = pdfjs.getDocument({ data, rangeChunkSize: 65536 });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoadedFile(fileName);
        charMapCacheRef.current = new Map();
        setRects([]);
        setStatus(`Loaded ${fileName} (${doc.numPages} pages)`);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load PDF:", err);
        setStatus("Failed to load PDF. Check filename, token, and backend.");
      }
    })();

    return () => {
      cancelled = true;
      abortCtrl.abort();
    };
  }, [fileName]);

  // Load outline for document
  useEffect(() => {
    if (!pdfDoc || !onOutlineLoaded) return;
    let cancelled = false;

    (async () => {
      try {
        const outlineRaw: any = await pdfDoc.getOutline();
        if (cancelled) return;
        if (!outlineRaw) {
          onOutlineLoaded([]);
          return;
        }
        const items: OutlineItem[] = [];
        for (let i = 0; i < outlineRaw.length; i++) {
          const item = outlineRaw[i];
          if (!item.dest) continue;
          const dest = await pdfDoc.getDestination(item.dest);
          if (!dest) continue;
          const ref = dest[0];
          const pageIndex = await pdfDoc.getPageIndex(ref);
          items.push({
            id: `outline-${i}`,
            title: item.title || `Page ${pageIndex + 1}`,
            pageNumber: pageIndex + 1
          });
        }
        if (!cancelled) {
          onOutlineLoaded(items);
        }
      } catch (e) {
        console.warn("getOutline not available or failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, onOutlineLoaded]);

  // Build rectangles for all citations
  useEffect(() => {
    if (!pdfDoc || !fileName) {
      setRects([]);
      return;
    }

    const relevant = citations.filter((c) => c.fileName === fileName);
    if (!relevant.length) {
      setRects([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const cache = charMapCacheRef.current;
      const all: HighlightRect[] = [];

      for (const c of relevant) {
        const pageIndex = c.pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= pdfDoc.numPages) continue;

        let charMap = cache.get(pageIndex);
        if (!charMap) {
          charMap = await buildCharMap(pdfDoc, pageIndex);
          if (cancelled) return;
          cache.set(pageIndex, charMap);
        }

        const baseRects = rectsForRange(charMap, c.offsetStart, c.offsetEnd);
        baseRects.forEach((r, idx) => {
          all.push({
            ...r,
            id: `${c.id}-${idx}`,
            citationId: c.id,
            color: c.color
          });
        });
      }

      if (!cancelled) {
        setRects(all);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, fileName, citations]);

  // Smooth scroll to active citation
  useEffect(() => {
    if (!activeCitationId) return;
    const target = rects.find((r) => r.citationId === activeCitationId);
    if (!target) return;
    const pageIndex = target.pageIndex;
    const el = pageRefs.current[pageIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeCitationId, rects]);

  // Handle selection-created highlight
  const handleSelection = async (rect: SelectionRectPageCoords) => {
    if (!pdfDoc || !fileName || !onCreateHighlight) return;
    let chars = charMapCacheRef.current.get(rect.pageIndex);
    if (!chars) {
      chars = await buildCharMap(pdfDoc, rect.pageIndex);
      charMapCacheRef.current.set(rect.pageIndex, chars);
    }

    const selected = chars.filter((c) => {
      const rRight = rect.x + rect.width;
      const rBottom = rect.y + rect.height;
      const cRight = c.x + c.width;
      const cBottom = c.y + c.height;
      return (
        c.x < rRight &&
        cRight > rect.x &&
        c.y < rBottom &&
        cBottom > rect.y
      );
    });

    if (!selected.length) return;

    const start = Math.min(...selected.map((c) => c.globalIndex));
    const end = Math.max(...selected.map((c) => c.globalIndex)) + 1;

    const newHighlight: HighlightInstruction = {
      id: `user-${Date.now()}`,
      fileName,
      pageNumber: rect.pageIndex + 1,
      offsetStart: start,
      offsetEnd: end
    };

    onCreateHighlight(newHighlight);
  };

  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13
        }}
      >
        <span style={{ fontWeight: 600, minWidth: 160 }}>
          {fileName || "No file selected"}
        </span>
        <span style={{ color: "#6b7280" }}>{status}</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          scrollBehavior: "smooth",
          background: "#9ca3af33",
          padding: 16
        }}
      >
        {pdfDoc ? (
          pageNumbers.map((pageNumber) => (
            <PageView
              key={pageNumber}
              pdfDoc={pdfDoc}
              pageNumber={pageNumber}
              scale={scale}
              rects={rects.filter((r) => r.pageIndex === pageNumber - 1)}
              activeCitationId={activeCitationId}
              highlightColor={highlightColor}
              refEl={(el) => {
                pageRefs.current[pageNumber - 1] = el;
              }}
              onSelection={handleSelection}
            />
          ))
        ) : (
          <div style={{ padding: 16, color: "#4b5563" }}>
            {fileName ? "Loading document..." : "Select a citation to load PDF."}
          </div>
        )}
      </div>
    </div>
  );
};

interface PageViewProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rects: HighlightRect[];
  activeCitationId: string | null;
  highlightColor: string;
  refEl: (el: HTMLDivElement | null) => void;
  onSelection: (rect: SelectionRectPageCoords) => void;
}

const PageView: React.FC<PageViewProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  rects,
  activeCitationId,
  highlightColor,
  refEl,
  onSelection
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

  // Lazy render: only when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      {
        root: null,
        threshold: 0.1
      }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport
        });

        await renderTask.promise;
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to render page", pageNumber, err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, scale, visible]);

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!isSelecting || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionEnd({ x, y });
  };

  const handleMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    if (!canvasRef.current) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const pageX = minX / scale;
    const pageY = minY / scale;
    const pageWidth = (maxX - minX) / scale;
    const pageHeight = (maxY - minY) / scale;

    onSelection({
      pageIndex: pageNumber - 1,
      x: pageX,
      y: pageY,
      width: pageWidth,
      height: pageHeight
    });

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const selectionBox =
    isSelecting && selectionStart && selectionEnd
      ? {
          left: Math.min(selectionStart.x, selectionEnd.x),
          top: Math.min(selectionStart.y, selectionEnd.y),
          width: Math.abs(selectionStart.x - selectionEnd.x),
          height: Math.abs(selectionStart.y - selectionEnd.y)
        }
      : null;

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        refEl(el);
      }}
      style={{
        position: "relative",
        margin: "0 auto 24px auto",
        width: "fit-content",
        cursor: isSelecting ? "crosshair" : "default"
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        style={{
          background: "#ffffff",
          boxShadow: "0 0 4px rgba(0,0,0,0.25)"
        }}
      />

      {/* Highlights overlay */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        }}
      >
        {rects.map((r) => {
          const left = r.x * scale;
          const top = r.y * scale;
          const width = r.width * scale;
          const height = r.height * scale;
          const isActive = r.citationId === activeCitationId;
          const baseColor = r.color || highlightColor;

          return (
            <div
              key={r.id}
              className={isActive ? "highlight-active" : undefined}
              style={{
                position: "absolute",
                left,
                top,
                width,
                height,
                backgroundColor: isActive
                  ? "rgba(255, 215, 0, 0.6)"
                  : baseColor || "rgba(255, 255, 0, 0.35)",
                mixBlendMode: "multiply"
              }}
            />
          );
        })}

        {/* Selection rectangle */}
        {selectionBox && (
          <div
            style={{
              position: "absolute",
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.width,
              height: selectionBox.height,
              border: "1px dashed #2563eb",
              backgroundColor: "rgba(37, 99, 235, 0.15)",
              pointerEvents: "none"
            }}
          />
        )}
      </div>
    </div>
  );
};
