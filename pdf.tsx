import React, { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { getPdfAsync } from "api/authenticated-fetch";

import "./pdfWorker";
import type { HighlightInstruction, HighlightRect, CharBox } from "../types";
import { buildCharMap, rectsForRange } from "./pdfTextIndex";

interface Props {
  fileName: string | null;
  citation: HighlightInstruction | null;
}

const BASE_SCALE = 1.0;
const ESTIMATED_PAGE_HEIGHT = 1000;
const PAGES_ABOVE = 3;
const PAGES_BELOW = 4;

export default function PdfViewer({ fileName, citation }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [rects, setRects] = useState<HighlightRect[]>([]);

  const [scale, setScale] = useState(BASE_SCALE);
  const [zoomPercent, setZoomPercent] = useState(100);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const measuredPageHeight = pageHeight ?? ESTIMATED_PAGE_HEIGHT;

  /* ---------- load PDF ---------- */
  useEffect(() => {
    if (!fileName) return;
    if (loadedFile === fileName && pdfDoc) return;

    let cancelled = false;

    (async () => {
      const data = await getPdfAsync(fileName);
      const doc = await pdfjs.getDocument({ data }).promise;
      if (cancelled) return;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setLoadedFile(fileName);
      setRects([]);
      setCurrentPage(1);
      setScrollTop(0);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  /* ---------- highlights ---------- */
  useEffect(() => {
    if (!pdfDoc || !citation || citation.fileName !== fileName) return;
    let cancel = false;

    (async () => {
      const idx = citation.pageNumber - 1;
      if (idx < 0 || idx >= pdfDoc.numPages) return;

      const chars: CharBox[] = await buildCharMap(pdfDoc, idx);
      if (cancel) return;

      const mRects = rectsForRange(
        chars,
        citation.offsetStart,
        citation.offsetEnd
      );
      setRects(
        mRects.map((r, x) => ({ ...r, id: citation.id + ":" + x }))
      );
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, citation, fileName]);

  /* ---------- scroll/virtualisation ---------- */
  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const top = e.currentTarget.scrollTop;
    setScrollTop(top);

    if (!numPages) return;
    const idx = Math.floor(top / measuredPageHeight);
    const page = Math.min(numPages, Math.max(1, idx + 1));
    setCurrentPage(page);
  };

  const currentIndex = Math.floor(scrollTop / measuredPageHeight);
  const startIndex = Math.max(0, currentIndex - PAGES_ABOVE);
  const endIndex = Math.min(numPages - 1, currentIndex + PAGES_BELOW);

  const paddingTop = startIndex * measuredPageHeight;
  const paddingBottom = (numPages - endIndex - 1) * measuredPageHeight;

  const visiblePages = Array.from(
    { length: endIndex - startIndex + 1 },
    (_, i) => startIndex + i + 1
  );

  /* ---------- helper: scroll to a specific page ---------- */
  const scrollToPage = (pageNumber: number) => {
    if (!containerRef.current || !numPages) return;
    const clamped = Math.min(numPages, Math.max(1, pageNumber));
    const idx = clamped - 1;
    const targetTop =
      idx * measuredPageHeight - containerRef.current.clientHeight / 3;

    containerRef.current.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  };

  /* ---------- scroll to citation ---------- */
  useEffect(() => {
    if (!citation) return;
    scrollToPage(citation.pageNumber);
  }, [citation, measuredPageHeight, numPages]);

  /* ---------- zoom ---------- */
  const handleZoomChange = (delta: number) => {
    setZoomPercent((prev) => {
      const next = Math.max(25, Math.min(400, prev + delta));
      setScale((BASE_SCALE * next) / 100);
      return next;
    });
  };

  const goPrevPage = () => scrollToPage(currentPage - 1);
  const goNextPage = () => scrollToPage(currentPage + 1);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: "100%",
        overflow: "auto",
        padding: 20,
        scrollBehavior: "smooth",
        background: "#f0f0f0", // Acrobat-style grey backdrop
      }}
    >
      {/* Acrobat-style top-centre toolbar */}
      <div
        className="flex items-center justify-center gap-6 mb-3"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#f0f0f0",
          paddingBottom: 6,
          paddingTop: 4,
        }}
      >
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevPage}
            className="border rounded px-2 py-1 text-xs"
          >
            ▲
          </button>
          <span className="text-xs">
            {numPages ? currentPage : 0} / {numPages || 0}
          </span>
          <button
            type="button"
            onClick={goNextPage}
            className="border rounded px-2 py-1 text-xs"
          >
            ▼
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleZoomChange(-5)}
            className="border rounded px-2 py-1 text-sm"
          >
            −
          </button>
          <span className="text-xs border rounded px-2 py-1 bg-white/80">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={() => handleZoomChange(5)}
            className="border rounded px-2 py-1 text-sm"
          >
            +
          </button>
        </div>
      </div>

      {!pdfDoc && "Loading..."}

      {pdfDoc && (
        <div style={{ paddingTop, paddingBottom }}>
          {visiblePages.map((pageNumber) => (
            <React.Fragment key={pageNumber}>
              <PageView
                pdfDoc={pdfDoc}
                pageNumber={pageNumber}
                scale={scale}
                rects={rects.filter((r) => r.pageIndex === pageNumber - 1)}
                onMeasuredHeight={(h) => {
                  if (!pageHeight && h) setPageHeight(h);
                }}
              />
              {/* Page splitter – soft grey line between pages */}
              {pageNumber < numPages && (
                <div
                  style={{
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "80%",
                      borderBottom: "1px solid #d4d4d4",
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function PageView({
  pdfDoc,
  pageNumber,
  scale,
  rects,
  onMeasuredHeight,
}: {
  pdfDoc: any;
  pageNumber: number;
  scale: number;
  rects: HighlightRect[];
  onMeasuredHeight?: (h: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    let cancel = false;

    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancel) return;

      const v = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = v.width;
      canvas.height = v.height;

      await page.render({ canvasContext: ctx, viewport: v }).promise;

      if (!reportedRef.current && onMeasuredHeight && canvas.height) {
        reportedRef.current = true;
        onMeasuredHeight(canvas.height);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pageNumber, scale, onMeasuredHeight]);

  return (
    <div
      style={{
        position: "relative",
        margin: "16px auto",
        width: "fit-content",
        background: "#ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}
    >
      <canvas ref={canvasRef} />

      {rects.map((r) => {
        const left = r.x * scale;
        const top = r.y * scale;
        const width = r.width * scale;
        const height = r.height * scale;

        return (
          <div
            key={r.id}
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              background: "rgba(255,255,0,0.35)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </div>
  );
}
