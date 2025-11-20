import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  UIEventHandler,
} from "react";
import * as pdfjs from "pdfjs-dist";
import { getPdfAsync } from "api/authenticated-fetch";

import "./pdfWorker";
import type { HighlightInstruction, HighlightRect, CharBox } from "../types";
import { buildCharMap, rectsForRange } from "./pdfTextIndex";

interface Props {
  fileName: string | null;
  // can be single or multiple citations
  citation: HighlightInstruction | HighlightInstruction[] | null;
}

const BASE_SCALE = 1.0;

// we treat this as base (scale=1) height
const ESTIMATED_BASE_PAGE_HEIGHT = 1000;
const PAGE_GAP = 24;
const PAGES_ABOVE = 3;
const PAGES_BELOW = 4;

export default function PdfViewer({ fileName, citation }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);

  const [rects, setRects] = useState<HighlightRect[]>([]);

  const [scale, setScale] = useState(BASE_SCALE);
  const [zoomPercent, setZoomPercent] = useState(100);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const [basePageHeight, setBasePageHeight] = useState<number | null>(null);
  const [ready, setReady] = useState(false); // true once we know real page height

  // effective slot height per page at current zoom
  const measuredPageHeight =
    (basePageHeight ?? ESTIMATED_BASE_PAGE_HEIGHT) * scale + PAGE_GAP;

  const [currentPage, setCurrentPage] = useState(1);

  // if we get a scroll request before we’re "ready" we queue it here
  const [pendingScrollPage, setPendingScrollPage] = useState<number | null>(
    null
  );

  /* ---------- citations normalised to array ---------- */

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

  const hasMultiCitations = citationList.length > 1;

  /* ---------- mark ready once we have a real base height ---------- */

  useEffect(() => {
    if (basePageHeight && !ready) setReady(true);
  }, [basePageHeight, ready]);

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
      setBasePageHeight(null);
      setReady(false);
      setPendingScrollPage(null);

      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  /* ---------- highlights ---------- */

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

  /* ---------- scroll / virtualisation ---------- */

  const handleScroll: UIEventHandler<HTMLDivElement> = (e) => {
    const top = e.currentTarget.scrollTop;
    setScrollTop(top);

    if (!numPages || !ready) return;
    const idx = Math.floor(top / measuredPageHeight);
    const page = Math.min(numPages, Math.max(1, idx + 1));
    setCurrentPage(page);
  };

  const currentIndex = ready ? Math.floor(scrollTop / measuredPageHeight) : 0;
  const startIndex = ready ? Math.max(0, currentIndex - PAGES_ABOVE) : 0;
  const endIndex = ready
    ? Math.min(numPages - 1, currentIndex + PAGES_BELOW)
    : 0;

  const paddingTop = startIndex * measuredPageHeight;
  const paddingBottom = (numPages - endIndex - 1) * measuredPageHeight;

  const visiblePages = Array.from(
    { length: endIndex - startIndex + 1 },
    (_, i) => startIndex + i + 1
  );

  /* ---------- helper: scroll to page (absolute) ---------- */

  const scrollToPage = (pageNumber: number) => {
    if (!scrollContainerRef.current || !numPages) return;
    const clamped = Math.min(numPages, Math.max(1, pageNumber));

    // if we’re not ready yet, queue and return
    if (!ready || !basePageHeight) {
      setPendingScrollPage(clamped);
      return;
    }

    const idx = clamped - 1;
    const targetTop = idx * measuredPageHeight;

    scrollContainerRef.current.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  };

  // once we become ready and have a pending scroll, execute it
  useEffect(() => {
    if (!ready || !pendingScrollPage) return;
    scrollToPage(pendingScrollPage);
    setPendingScrollPage(null);
  }, [ready, pendingScrollPage]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- scroll to active citation when it changes ---------- */

  useEffect(() => {
    if (!activeCitation) return;
    scrollToPage(activeCitation.pageNumber);
  }, [activeCitation, numPages]); // scale/height changes are handled by scrollToPage + ready logic

  /* ---------- zoom ---------- */

  const handleZoomChange = (delta: number) => {
    setZoomPercent((prev) => {
      const next = Math.max(25, Math.min(400, prev + delta));
      setScale((BASE_SCALE * next) / 100);
      return next;
    });
  };

  /* ---------- page arrows (use absolute page index) ---------- */

  const goPrevPage = () => scrollToPage(currentPage - 1);
  const goNextPage = () => scrollToPage(currentPage + 1);

  /* ---------- citation arrows ---------- */

  const goPrevCitation = () => {
    if (!hasMultiCitations) return;
    setCurrentCitationIndex((i) => Math.max(0, i - 1));
  };

  const goNextCitation = () => {
    if (!hasMultiCitations) return;
    setCurrentCitationIndex((i) =>
      Math.min(citationList.length - 1, i + 1)
    );
  };

  /* ---------- RENDER ---------- */

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f0f0f0",
      }}
    >
      {/* TOOLBAR – top, full width, white background */}
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
          {/* Left: page navigation */}
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

          {/* Centre: zoom controls */}
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

          {/* Right: citation navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevCitation}
              disabled={!hasMultiCitations}
              className={`border rounded px-2 py-1 text-xs ${
                hasMultiCitations ? "" : "opacity-40 cursor-not-allowed"
              }`}
            >
              ◀ Prev citation
            </button>
            <button
              type="button"
              onClick={goNextCitation}
              disabled={!hasMultiCitations}
              className={`border rounded px-2 py-1 text-xs ${
                hasMultiCitations ? "" : "opacity-40 cursor-not-allowed"
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
        onScroll={handleScroll}
        style={{
          flex: "1 1 auto",
          overflow: "auto",
          padding: 20,
          scrollBehavior: "smooth",
        }}
      >
        {!pdfDoc && "Loading..."}

        {pdfDoc && (
          <div style={{ paddingTop, paddingBottom }}>
            {visiblePages.map((pageNumber) => (
              <PageView
                key={pageNumber}
                pdfDoc={pdfDoc}
                pageNumber={pageNumber}
                scale={scale}
                rects={rects.filter(
                  (r) => r.pageIndex === pageNumber - 1
                )}
                onMeasuredBaseHeight={(baseH) => {
                  if (!basePageHeight && baseH) setBasePageHeight(baseH);
                }}
                pageGap={PAGE_GAP}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- PageView ---------- */

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

      if (onMeasuredBaseHeight) {
        const baseHeight = viewport.height / scale;
        onMeasuredBaseHeight(baseHeight);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [pdfDoc, pageNumber, scale, onMeasuredBaseHeight]);

  return (
    <div
      data-page={pageNumber}
      style={{
        position: "relative",
        margin: "0 auto",
        marginBottom: pageGap,
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
