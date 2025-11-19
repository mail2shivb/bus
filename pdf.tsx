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
const ESTIMATED_PAGE_HEIGHT = 1000; // base (unscaled) estimate
const BASE_PAGE_GAP = 16;           // constant vertical gap between pages
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

  // NEW: base page height (for scale = 1). Virtualisation uses this.
  const [basePageHeight, setBasePageHeight] = useState<number | null>(null);

  // total slot height per page at current zoom
  const measuredPageHeight =
    (basePageHeight ?? ESTIMATED_PAGE_HEIGHT) * scale + BASE_PAGE_GAP;

  const [currentPage, setCurrentPage] = useState(1);

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
        background: "#f0f0f0",
      }}
    >
      {/* top toolbar kept as-is */}
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
            <PageView
              key={pageNumber}
              pdfDoc={pdfDoc}
              pageNumber={pageNumber}
              scale={scale}
              rects={rects.filter((r) => r.pageIndex === pageNumber - 1)}
              onMeasuredBaseHeight={(h) => {
                // h is the base (unscaled) height of the page
                if (!basePageHeight && h) setBasePageHeight(h);
              }}
              pageGap={BASE_PAGE_GAP}
            />
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
  onMeasuredBaseHeight,
  pageGap,
}: {
  pdfDoc: any;
  pageNumber: number;
  scale: number;
  rects: HighlightRect[];
  onMeasuredBaseHeight?: (h: number) => void;
  pageGap: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancel = false;

    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancel) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // report BASE (scale=1) height so virtualisation can adjust for zoom
      if (onMeasuredBaseHeight) {
        const baseHeight = viewport.height / scale; // H( scale=1 )
        onMeasuredBaseHeight(baseHeight);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pageNumber, scale, onMeasuredBaseHeight]);

  return (
    <div
      style={{
        position: "relative",
        margin: "0 auto",
        marginBottom: pageGap, // constant gap included in virtual height
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
