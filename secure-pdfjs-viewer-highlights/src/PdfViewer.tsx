import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getPdfAsync } from "./authenticatedFetch";
import "./pdfWorker";
import type { HighlightInstruction, HighlightRect, CharBox } from "./types";
import { buildCharMap, rectsForRange } from "./lib/pdfTextIndex";

const DEFAULT_SCALE = 1.25;
const EMPTY_SCOPES: string[] = [];
interface PdfViewerProps {
  fileName: string;
  scopes?: string[];
  highlights?: HighlightInstruction[];
  activeHighlightId?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileName,
  scopes = EMPTY_SCOPES,
  highlights = [],
  activeHighlightId,
}) => {
  const [status, setStatus] = useState<string>("Idle");
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);
  const [rects, setRects] = useState<HighlightRect[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    const abortCtrl = new AbortController();

    (async () => {
      try {
        setStatus("Loading PDF...");
        setPdfDoc(null);
        setNumPages(0);
        setRects([]);

        const data = await getPdfAsync(fileName, abortCtrl.signal, scopes);

        const loadingTask = pdfjsLib.getDocument({
          data,
          rangeChunkSize: 65536,
        });

        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
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
  }, [fileName, scopes]);

  useEffect(() => {
    if (!pdfDoc || !highlights.length) {
      setRects([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const relevant = highlights.filter((h) => h.fileName === fileName);
      if (!relevant.length) {
        setRects([]);
        return;
      }

      const cache = new Map<number, CharBox[]>();
      const allRects: HighlightRect[] = [];

      for (const h of relevant) {
        const pageIndex = h.pageNumber - 1;
        let charMap = cache.get(pageIndex);
        if (!charMap) {
          charMap = await buildCharMap(pdfDoc, pageIndex);
          cache.set(pageIndex, charMap);
        }

        const rectsForHighlight = rectsForRange(
          charMap,
          h.offsetStart,
          h.offsetEnd
        );

        rectsForHighlight.forEach((r) => {
          allRects.push({
            ...r,
            id: h.id,
          });
        });
      }

      if (!cancelled) {
        setRects(allRects);
      }
    })().catch((e) => {
      console.error("Error building highlight rects:", e);
      if (!cancelled) setRects([]);
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, highlights, fileName]);

  useEffect(() => {
    if (!activeHighlightId) return;
    const target = rects.find((r) => r.id === activeHighlightId);
    if (!target) return;

    const pageEl = pageRefs.current[target.pageIndex];
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeHighlightId, rects]);

  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 600 }}>{fileName}</span>
        <span style={{ color: "#6b7280" }}>{status}</span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>Zoom:</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            -
          </button>
          <span>{scale.toFixed(2)}x</span>
          <button type="button" onClick={() => setScale((s) => s + 0.25)}>
            +
          </button>
        </span>
      </div>

      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          scrollBehavior: "smooth",
          background: "#9ca3af33",
          padding: 16,
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
              activeHighlightId={activeHighlightId}
              containerRef={(el) => {
                pageRefs.current[pageNumber - 1] = el;
              }}
            />
          ))
        ) : (
          <div style={{ padding: 16, color: "#4b5563" }}>
            No document loaded.
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
  activeHighlightId?: string;
  containerRef: (el: HTMLDivElement | null) => void;
}

const PageView: React.FC<PageViewProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  rects,
  activeHighlightId,
  containerRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
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
          viewport,
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
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        margin: "0 auto 24px auto",
        width: "fit-content",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          background: "#ffffff",
          boxShadow: "0 0 4px rgba(0,0,0,0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {rects.map((r, idx) => {
          const left = (r.x / r.pageWidth) * 100;
          const top = (r.y / r.pageHeight) * 100;
          const width = (r.width / r.pageWidth) * 100;
          const height = (r.height / r.pageHeight) * 100;
          const isActive = r.id === activeHighlightId;

          return (
            <div
              key={r.id + "-" + idx}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                backgroundColor: isActive
                  ? "rgba(255, 215, 0, 0.6)"
                  : "rgba(255, 255, 0, 0.35)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
