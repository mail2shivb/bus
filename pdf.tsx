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
