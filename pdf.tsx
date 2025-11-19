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

const BASE_SCALE = 1.0;          // rendering scale
const ESTIMATED_PAGE_HEIGHT = 1000; // fallback until we measure real height
const PAGES_ABOVE = 3;
const PAGES_BELOW = 4;

export default function PdfViewer({ fileName, citation }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [rects, setRects] = useState<HighlightRect[]>([]);

  const [scale, setScale] = useState(BASE_SCALE);
  const [zoomPercent, setZoomPercent] = useState(100);     // just for UI display

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [pageHeight, setPageHeight] = useState<number | null>(null); // height at BASE_SCALE

  const measuredPageHeight = pageHeight ?? ESTIMATED_PAGE_HEIGHT;

  /* ---------- load PDF when file changes ---------- */
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
    })();

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  /* ---------- build highlight rects (same logic as before) ---------- */
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

  /* ---------- update scrollTop from container ---------- */
  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  /* ---------- virtualisation: determine visible page range ---------- */
  const currentIndex = Math.floor(scrollTop / measuredPageHeight);
  const startIndex = Math.max(0, currentIndex - PAGES_ABOVE);
  const endIndex = Math.min(
    numPages - 1,
    currentIndex + PAGES_BELOW
  );

  const paddingTop = startIndex * measuredPageHeight;
  const paddingBottom =
    (numPages - endIndex - 1) * measuredPageHeight;

  /* ---------- scroll to citation page by setting scrollTop ---------- */
  useEffect(() => {
    if (!citation || !containerRef.current) return;
    if (!numPages) return;

    const idx = citation.pageNumber - 1;
    if (idx < 0 || idx >= numPages) return;

    const pageH = measuredPageHeight;
    const targetTop =
      idx * pageH - containerRef.current.clientHeight / 3;

    containerRef.current.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }, [citation, numPages, measuredPageHeight]);

  /* ---------- zoom controls (re-render only visible pages) ---------- */

  const handleZoomChange = (delta: number) => {
    setZoomPercent((prev) => {
      const next = Math.max(25, Math.min(400, prev + delta));
      // convert percent to scale relative to BASE_SCALE
      setScale((BASE_SCALE * next) / 100);
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: "100%",
        overflow: "auto",
        padding: 20,
        scrollBehavior: "smooth",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex justify-end items-center gap-2 mb-2"
        style={{ position: "sticky", top: 0, zIndex: 10, background: "white" }}
      >
        <button
          type="button"
          onClick={() => handleZoomChange(-5)}
          title="Zoom out (−5%)"
          className="border rounded px-2 py-1 text-sm"
        >
          −
        </button>

        <div
          title={`${zoomPercent}%`}
          className="border rounded px-2 py-1 text-xs bg-white/80"
        >
          {zoomPercent}%
        </div>

        <button
          type="button"
          onClick={() => handleZoomChange(5)}
          title="Zoom in (+5%)"
          className="border rounded px-2 py-1 text-sm"
        >
          +
        </button>
      </div>

      {!pdfDoc && "Loading..."}

      {pdfDoc && (
        <div style={{ paddingTop, paddingBottom }}>
          {Array.from(
            { length: endIndex - startIndex + 1 },
            (_, i) => startIndex + i + 1
          ).map((pageNumber) => (
            <PageView
              key={pageNumber}
              pdfDoc={pdfDoc}
              pageNumber={pageNumber}
              scale={scale}
              rects={rects.filter((r) => r.pageIndex === pageNumber - 1)}
              onMeasuredHeight={(h) => {
                if (!pageHeight && h) setPageHeight(h);
              }}
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

      if (!reportedRef.current && onMeasuredHeight) {
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
        margin: "20px auto",
        width: "fit-content",
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
