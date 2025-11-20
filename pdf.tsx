import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { getPdfAsync } from "api/authenticated-fetch";

import "./pdfWorker";
import type { HighlightInstruction, HighlightRect, CharBox } from "../types";
import { buildCharMap, rectsForRange } from "./pdfTextIndex";

interface Props {
  fileName: string | null;
  // single or multiple citations
  citation: HighlightInstruction | HighlightInstruction[] | null;
}

const RENDER_SCALE = 1.2; // canvas render scale (quality)
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const PAGE_GAP_PX = 4; // fixed small gap between pages

type PdfDoc = pdfjs.PDFDocumentProxy;

/* ------------------------------------------------------------------ */
/*  CACHES – avoid reloading / re-indexing on every mount             */
/* ------------------------------------------------------------------ */

const pdfDocCache = new Map<string, PdfDoc>(); // filename -> pdfDoc
const charMapCache = new Map<string, CharBox[]>(); // "file:pageIndex" -> char map

async function getPdfDocCached(fileName: string): Promise<PdfDoc> {
  if (pdfDocCache.has(fileName)) {
    return pdfDocCache.get(fileName)!;
  }
  const data = await getPdfAsync(fileName);
  const doc = await pdfjs.getDocument({ data }).promise;
  pdfDocCache.set(fileName, doc);
  return doc;
}

async function getCharMapCached(
  doc: PdfDoc,
  fileName: string,
  pageIndex: number
): Promise<CharBox[]> {
  const key = `${fileName}:${pageIndex}`;
  if (charMapCache.has(key)) {
    return charMapCache.get(key)!;
  }
  const chars = await buildCharMap(doc, pageIndex);
  charMapCache.set(key, chars);
  return chars;
}

/* ------------------------------------------------------------------ */

export default function PdfViewer({ fileName, citation }: Props) {
  const [pdfDoc, setPdfDoc] = useState<PdfDoc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [rects, setRects] = useState<HighlightRect[]>([]);

  const [zoomPercent, setZoomPercent] = useState(100);
  const zoomFactor = zoomPercent / 100;

  const [currentPage, setCurrentPage] = useState(1);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ---------- normalise citations ---------- */

  const citationList: HighlightInstruction[] = useMemo(() => {
    if (!citation) return [];
    return Array.isArray(citation) ? citation : [citation];
  }, [citation]);

  const [currentCitationIndex, setCurrentCitationIndex] = useState(0);

  useEffect(() => {
    setCurrentCitationIndex(0);
  }, [citationList.length, fileName]);

  const activeCitation: HighlightInstruction | null =
    citationList.length > 0 ? citationList[currentCitationIndex] : null;

  const canPrevCitation =
    citationList.length > 0 && currentCitationIndex > 0;
  const canNextCitation =
    citationList.length > 0 &&
    currentCitationIndex < citationList.length - 1;

  /* ---------- load PDF once per file (from cache if present) ---------- */

  useEffect(() => {
    if (!fileName) return;
    if (loadedFile === fileName && pdfDoc) return;

    let cancelled = false;

    (async () => {
      const doc = await getPdfDocCached(fileName);
      if (cancelled) return;

      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setLoadedFile(fileName);
      setRects([]);
      setCurrentPage(1);

      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  /* ---------- build highlight rects for active citation ---------- */

  useEffect(() => {
    if (!pdfDoc || !activeCitation || activeCitation.fileName !== fileName) {
      setRects([]);
      return;
    }
    let cancel = false;

    (async () => {
      const idx = activeCitation.pageNumber - 1;
      if (idx < 0 || idx >= pdfDoc.numPages) return;

      const chars: CharBox[] = await getCharMapCached(
        pdfDoc,
        activeCitation.fileName,
        idx
      );
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

  /* ---------- scroll helpers (no virtualisation) ---------- */

  const scrollToPage = (pageNumber: number, attempt = 0) => {
    if (!numPages) return;

    const clamped = Math.min(numPages, Math.max(1, pageNumber));
    const el = pageRefs.current[clamped - 1];

    if (!el) {
      if (attempt < 10) {
        setTimeout(() => scrollToPage(pageNumber, attempt + 1), 50);
      }
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage((prev) => (prev === clamped ? prev : clamped));
  };

  // Scroll when citation changes (initial + prev/next)
  useEffect(() => {
    if (!activeCitation || !numPages) return;
    scrollToPage(activeCitation.pageNumber);
  }, [activeCitation, numPages]);

  /* ---------- toolbar actions ---------- */

  const handleZoomChange = (delta: number) => {
    setZoomPercent((prev) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      return next;
    });
  };

  const goPrevPage = () => scrollToPage(currentPage - 1);
  const goNextPage = () => scrollToPage(currentPage + 1);

  const goPrevCitation = () => {
    if (!canPrevCitation) return;
    setCurrentCitationIndex((i) => Math.max(0, i - 1));
  };

  const goNextCitation = () => {
    if (!canNextCitation) return;
    setCurrentCitationIndex((i) =>
      Math.min(citationList.length - 1, i + 1)
    );
  };

  const shortFileName =
    fileName && fileName.length > 60
      ? "…" + fileName.slice(-60)
      : fileName || "";

  /* ---------- render ---------- */

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f0f0f0",
      }}
    >
      {/* Filename bar ABOVE toolbar */}
      <div
        style={{
          flex: "0 0 auto",
          width: "100%",
          background: "#f7f7f7",
          borderBottom: "1px solid #e0e0e0",
          padding: "4px 16px",
        }}
      >
        <div className="text-xs text-gray-700 truncate">
          {shortFileName}
        </div>
      </div>

      {/* Toolbar – full width, white */}
      <div
        style={{
          flex: "0 0 auto",
          width: "100%",
          background: "#ffffff",
          borderBottom: "1px solid #e0e0e0",
          padding: "6px 16px",
        }}
      >
        <div className="flex items-center justify-between">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevPage}
              disabled={!numPages || currentPage <= 1}
              className="border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▲
            </button>
            <span className="text-xs">
              {numPages ? currentPage : 0} / {numPages || 0}
            </span>
            <button
              type="button"
              onClick={goNextPage}
              disabled={!numPages || currentPage >= numPages}
              className="border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
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
            <span className="text-xs border rounded px-2 py-1 bg-white">
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

          {/* Citation navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevCitation}
              disabled={!canPrevCitation}
              className={`border rounded px-2 py-1 text-xs ${
                canPrevCitation ? "" : "opacity-40 cursor-not-allowed"
              }`}
            >
              ◀ Prev citation
            </button>
            <button
              type="button"
              onClick={goNextCitation}
              disabled={!canNextCitation}
              className={`border rounded px-2 py-1 text-xs ${
                canNextCitation ? "" : "opacity-40 cursor-not-allowed"
              }`}
            >
              Next citation ▶
            </button>

            {citationList.length > 0 && (
              <span className="text-xs text-gray-500">
                {currentCitationIndex + 1} / {citationList.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable pages */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: "1 1 auto",
          overflow: "auto",
          padding: "4px 16px 8px",
          scrollBehavior: "smooth",
        }}
      >
        {!pdfDoc && "Loading..."}

        {pdfDoc &&
          Array.from({ length: numPages }, (_, i) => i + 1).map(
            (pageNumber) => (
              <PageView
                key={pageNumber}
                pdfDoc={pdfDoc}
                pageNumber={pageNumber}
                renderScale={RENDER_SCALE}
                zoom={zoomFactor}
                rects={rects.filter(
                  (r) => r.pageIndex === pageNumber - 1
                )}
                refEl={(el) => (pageRefs.current[pageNumber - 1] = el)}
                forceRender={
                  !!activeCitation &&
                  activeCitation.pageNumber === pageNumber
                }
              />
            )
          )}
      </div>
    </div>
  );
}

/* ---------- PageView: lazy canvas render + CSS zoom, tiny fixed gap ---------- */

function PageView({
  pdfDoc,
  pageNumber,
  renderScale,
  zoom,
  rects,
  refEl,
  forceRender,
}: {
  pdfDoc: PdfDoc;
  pageNumber: number;
  renderScale: number;
  zoom: number;
  rects: HighlightRect[];
  refEl: (el: HTMLDivElement | null) => void;
  forceRender: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState<boolean>(forceRender);

  // IntersectionObserver to render only when visible
  useEffect(() => {
    if (forceRender) {
      setShouldRender(true);
      return;
    }
    if (shouldRender) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [forceRender, shouldRender]);

  // Render the PDF page into the canvas when shouldRender is true
  useEffect(() => {
    if (!shouldRender) return;

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
  }, [pdfDoc, pageNumber, renderScale, shouldRender]);

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        refEl(el);
      }}
      style={{
        margin: `0 auto ${PAGE_GAP_PX}px`,
        width: "fit-content",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
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
    </div>
  );
}
