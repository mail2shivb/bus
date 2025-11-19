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

export default function PdfViewer({ fileName, citation }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [rects, setRects] = useState<HighlightRect[]>([]);

  // ---------- NEW: zoom ----------
  const [zoomPercent, setZoomPercent] = useState(100); // 100% by default
  const zoom = zoomPercent / 100;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageBaseWidth, setPageBaseWidth] = useState<number | null>(null); // width of page at base scale

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const baseScale = 1; // pdfjs render scale – keep fixed for performance

  // fetch only if new file
  useEffect(() => {
    if (!fileName) return;
    if (loadedFile === fileName && pdfDoc) return; // cached

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

  // build highlight rects (unchanged)
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

  // scroll to page (unchanged)
  useEffect(() => {
    if (!citation || !rects.length) return;
    const idx = citation.pageNumber - 1;
    const el = pageRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [citation, rects]);

  // Fit-to-width button handler (no live autoscale => no laggy divider)
  const handleFitWidth = () => {
    if (!containerRef.current || !pageBaseWidth) return;
    // available width = container width minus padding (20 left + 20 right)
    const available = containerRef.current.clientWidth - 40;
    if (available <= 0) return;
    const neededPercent = (available / pageBaseWidth) * 100;
    setZoomPercent(Math.round(neededPercent));
  };

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        overflow: "auto",
        padding: 20,
        scrollBehavior: "smooth",
      }}
    >
      {/* Acrobat-ish toolbar */}
      <div
        className="flex justify-end items-center gap-2 mb-2"
        style={{ position: "sticky", top: 0, zIndex: 10, background: "white" }}
      >
        <button
          type="button"
          onClick={() =>
            setZoomPercent((p) => Math.max(25, p - 5)) // step 5%
          }
          title="Zoom out (Ctrl + '-')"
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
          onClick={() =>
            setZoomPercent((p) => Math.min(400, p + 5)) // step 5%
          }
          title="Zoom in (Ctrl + '+')"
          className="border rounded px-2 py-1 text-sm"
        >
          +
        </button>

        <button
          type="button"
          onClick={handleFitWidth}
          title="Fit page width"
          className="border rounded px-2 py-1 text-xs"
        >
          Fit
        </button>
      </div>

      {pdfDoc
        ? Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
            <PageView
              key={p}
              pdfDoc={pdfDoc}
              pageNumber={p}
              scale={baseScale}
              zoom={zoom}
              rects={rects.filter((r) => r.pageIndex === p - 1)}
              refEl={(el) => (pageRefs.current[p - 1] = el)}
              // for the first page, capture its base pixel width once
              onBaseWidth={(w) => {
                if (p === 1 && !pageBaseWidth) {
                  setPageBaseWidth(w);
                }
              }}
            />
          ))
        : "Loading..."}
    </div>
  );
}

function PageView({
  pdfDoc,
  pageNumber,
  scale,
  zoom,
  rects,
  refEl,
  onBaseWidth,
}: {
  pdfDoc: any;
  pageNumber: number;
  scale: number;         // pdfjs render scale (fixed = 1)
  zoom: number;          // CSS zoom factor
  rects: HighlightRect[];
  refEl: (el: HTMLDivElement | null) => void;
  onBaseWidth?: (w: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reportedWidthRef = useRef(false);

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

      if (!reportedWidthRef.current && onBaseWidth && canvas.width) {
        reportedWidthRef.current = true;
        onBaseWidth(canvas.width);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pageNumber, scale, onBaseWidth]);

  return (
    <div
      ref={refEl}
      style={{
        position: "relative",
        margin: "20px auto",
        width: "fit-content",
        transform: `scale(${zoom})`,
        transformOrigin: "top center",
      }}
    >
      <canvas ref={canvasRef} />

      {/* highlights (note: use base `scale`, not `zoom`) */}
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
