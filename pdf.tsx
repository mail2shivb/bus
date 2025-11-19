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

  // === fit-width autoscale ===
  const containerRef = useRef<HTMLDivElement | null>(null);
  const basePageWidthRef = useRef<number | null>(null);
  const [autoScale, setAutoScale] = useState(1); // used for canvas rendering

  // === user zoom (5% steps) ===
  const [zoomPercent, setZoomPercent] = useState(100); // 100 = 100%
  const zoomFactor = zoomPercent / 100;

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ---------- load PDF when file changes ---------- */
  useEffect(() => {
    if (!fileName) return;
    if (loadedFile === fileName && pdfDoc) return; // already loaded

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

  /* ---------- compute base width + autoscale on resize ---------- */
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let handler: (() => void) | null = null;

    const setup = async () => {
      const firstPage = await pdfDoc.getPage(1);
      if (cancelled) return;

      const viewport = firstPage.getViewport({ scale: 1 });
      basePageWidthRef.current = viewport.width;

      handler = () => {
        if (!containerRef.current || basePageWidthRef.current == null) return;
        const width = containerRef.current.clientWidth;
        if (!width) return;
        setAutoScale(width / basePageWidthRef.current);
      };

      handler(); // initial fit

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => handler && handler());
        resizeObserver.observe(containerRef.current);
      } else {
        window.addEventListener("resize", handler);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (resizeObserver && containerRef.current) {
        resizeObserver.disconnect();
      }
      if (handler) {
        window.removeEventListener("resize", handler);
      }
    };
  }, [pdfDoc]);

  /* ---------- (optional) keyboard zoom shortcuts ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "+" || e.key === "=") {
        setZoomPercent((p) => Math.min(300, p + 5)); // +5%
      } else if (e.key === "-" || e.key === "_") {
        setZoomPercent((p) => Math.max(25, p - 5)); // -5%, min 25%
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- build highlight rects ---------- */
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

  /* ---------- scroll to citation page ---------- */
  useEffect(() => {
    if (!citation || !rects.length) return;
    const idx = citation.pageNumber - 1;
    const el = pageRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [citation, rects]);

  const displayScale = autoScale * zoomFactor; // for showing 100%, 105%, etc.

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
      {/* Zoom toolbar */}
      <div
        className="flex justify-end items-center gap-2 mb-2"
        style={{ position: "sticky", top: 0, zIndex: 10, background: "white" }}
      >
        <button
          type="button"
          onClick={() =>
            setZoomPercent((p) => Math.max(25, p - 5)) // step by 5%
          }
          title="Zoom out (Ctrl + '-')"
          className="border rounded px-2 py-1 text-sm"
        >
          −
        </button>

        <div
          title={`${Math.round(displayScale * 100)}%`}
          className="border rounded px-2 py-1 text-xs bg-white/80"
        >
          {Math.round(displayScale * 100)}%
        </div>

        <button
          type="button"
          onClick={() =>
            setZoomPercent((p) => Math.min(300, p + 5)) // step by 5%
          }
          title="Zoom in (Ctrl + '+')"
          className="border rounded px-2 py-1 text-sm"
        >
          +
        </button>
      </div>

      {pdfDoc
        ? Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
            <PageView
              key={p}
              pdfDoc={pdfDoc}
              pageNumber={p}
              renderScale={autoScale}
              zoom={zoomFactor}
              rects={rects.filter((r) => r.pageIndex === p - 1)}
              refEl={(el) => (pageRefs.current[p - 1] = el)}
            />
          ))
        : "Loading..."}
    </div>
  );
}

/* ---------------- PageView ---------------- */

function PageView({
  pdfDoc,
  pageNumber,
  renderScale,
  zoom,
  rects,
  refEl,
}: {
  pdfDoc: any;
  pageNumber: number;
  renderScale: number;
  zoom: number;
  rects: HighlightRect[];
  refEl: (el: HTMLDivElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // render pdf page ONLY when doc or renderScale changes
  useEffect(() => {
    let cancel = false;

    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancel) return;

      const viewport = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pageNumber, renderScale]);

  // highlight positions in "renderScale" space
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

      {rects.map((r) => {
        const left = r.x * renderScale;
        const top = r.y * renderScale;
        const width = r.width * renderScale;
        const height = r.height * renderScale;

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
