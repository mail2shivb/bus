import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { getPdfAsync } from "api/authenticated-fetch";

import "./pdfWorker";
import type { HighlightInstruction, HighlightRect, CharBox } from "../types";
import { buildCharMap, rectsForRange } from "./pdfTextIndex";

interface Props {
  fileName: string | null;
  /**
   * Can be a single citation or an array of citations.
   * PdfViewer will handle prev/next navigation when array is given.
   */
  citation: HighlightInstruction | HighlightInstruction[] | null;
}

export default function PdfViewer({ fileName, citation }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);

  const [rects, setRects] = useState<HighlightRect[]>([]);

  // ---------- autoscale to fit panel width ----------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const basePageWidthRef = useRef<number | null>(null);
  const [autoScale, setAutoScale] = useState(1); // used for rendering

  // ---------- user zoom (5% steps) ----------
  const [zoomPercent, setZoomPercent] = useState(100); // 100 = 100%
  const zoomFactor = zoomPercent / 100;

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ---------- normalise citations ----------
  const citationList: HighlightInstruction[] = useMemo(() => {
    if (!citation) return [];
    return Array.isArray(citation) ? citation : [citation];
  }, [citation]);

  const [currentCitationIndex, setCurrentCitationIndex] = useState(0);

  // reset index when new citations arrive
  useEffect(() => {
    setCurrentCitationIndex(0);
  }, [citationList.length, fileName]);

  const activeCitation: HighlightInstruction | null =
    citationList.length > 0 ? citationList[currentCitationIndex] : null;

  /* ================== LOAD PDF ================== */

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

  /* ================== AUTOSCALE (FIT WIDTH) ================== */

  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;
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
        ro = new ResizeObserver(() => handler && handler());
        ro.observe(containerRef.current);
      } else {
        window.addEventListener("resize", handler!);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (ro && containerRef.current) ro.disconnect();
      if (handler) window.removeEventListener("resize", handler);
    };
  }, [pdfDoc]);

  /* ================== KEYBOARD ZOOM (Ctrl +/−) ================== */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "+" || e.key === "=") {
        setZoomPercent((p) => Math.min(300, p + 5));
      } else if (e.key === "-" || e.key === "_") {
        setZoomPercent((p) => Math.max(25, p - 5));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ================== BUILD HIGHLIGHT RECTS ================== */

  useEffect(() => {
    if (!pdfDoc || !activeCitation || activeCitation.fileName !== fileName) {
      setRects([]);
      return;
    }
    let cancel = false;

    (async () => {
      const idx = activeCitation.pageNumber - 1;
      if (idx < 0 || idx >= pdfDoc.numPages) return;

      const chars: CharBox[] = await buildCharMap(pdfDoc, idx);
      if (cancel) return;

      const mRects = rectsForRange(
        chars,
        activeCitation.offsetStart,
        activeCitation.offsetEnd
      );
      setRects(
        mRects.map((r, x) => ({ ...r, id: activeCitation.id + ":" + x }))
      );
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, activeCitation, fileName]);

  /* ================== SCROLL TO ACTIVE CITATION PAGE ================== */

  useEffect(() => {
    if (!activeCitation || !rects.length) return;
    const idx = activeCitation.pageNumber - 1;
    const el = pageRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeCitation, rects]);

  const hasMultiCitations = citationList.length > 1;
  const displayScale = autoScale * zoomFactor;

  const handlePrevCitation = () => {
    if (!hasMultiCitations) return;
    setCurrentCitationIndex((i) => Math.max(0, i - 1));
  };

  const handleNextCitation = () => {
    if (!hasMultiCitations) return;
    setCurrentCitationIndex((i) =>
      Math.min(citationList.length - 1, i + 1)
    );
  };

  /* ================== RENDER ================== */

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
      {/* Acrobat-style toolbar: TOP CENTER, sticky */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "white",
          padding: "4px 0 8px 0",
        }}
      >
        <div className="flex justify-center items-center gap-3">
          {/* Zoom controls */}
          <button
            type="button"
            onClick={() =>
              setZoomPercent((p) => Math.max(25, p - 5))
            }
            title="Zoom out (Ctrl + '-')"
            className="border rounded px-2 py-1 text-sm"
          >
            −
          </button>

          <div
            title={`${Math.round(displayScale * 100)}%`}
            className="border rounded px-3 py-1 text-xs bg-white/80"
          >
            {Math.round(displayScale * 100)}%
          </div>

          <button
            type="button"
            onClick={() =>
              setZoomPercent((p) => Math.min(300, p + 5))
            }
            title="Zoom in (Ctrl + '+')"
            className="border rounded px-2 py-1 text-sm"
          >
            +
          </button>

          {/* Spacer */}
          <div className="w-px h-5 bg-gray-300 mx-2" />

          {/* Previous / Next citation */}
          <button
            type="button"
            onClick={handlePrevCitation}
            disabled={!hasMultiCitations}
            className={`border rounded px-2 py-1 text-xs ${
              hasMultiCitations ? "" : "opacity-40 cursor-not-allowed"
            }`}
          >
            ◀ Prev citation
          </button>

          <button
            type="button"
            onClick={handleNextCitation}
            disabled={!hasMultiCitations}
            className={`border rounded px-2 py-1 text-xs ${
              hasMultiCitations ? "" : "opacity-40 cursor-not-allowed"
            }`}
          >
            Next citation ▶
          </button>

          {hasMultiCitations && (
            <span className="text-xs text-gray-500">
              {currentCitationIndex + 1} / {citationList.length}
            </span>
          )}
        </div>
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

/* ================== PageView ================== */

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
  renderScale: number; // fits width
  zoom: number; // user zoom
  rects: HighlightRect[];
  refEl: (el: HTMLDivElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // render only when pdfDoc or renderScale changes
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

      // HiDPI / crisper fonts – closer to Acrobat
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = viewport.width * outputScale;
      canvas.height = viewport.height * outputScale;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      await page.render({
        canvasContext: ctx,
        viewport,
        transform,
      }).promise;
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pageNumber, renderScale]);

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

      {/* highlights – computed in "renderScale" space */}
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
