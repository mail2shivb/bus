import { useState, useEffect, useCallback } from 'react';
import { Citation, Rect, PageTextMap } from '../lib/types';
import { buildPageTextMap, calculateHighlightRects } from '../lib/offsetMapping';

interface HighlightResult {
  rects: Rect[];
  pageNumber: number;
}

/**
 * Hook for computing and caching citation highlights.
 * Debounces computation to avoid excessive recalculation.
 * 
 * @param citation - The active citation to highlight
 * @param textLayerRef - Reference to the text layer element
 * @param currentPageNumber - The currently rendered page number
 * @returns Highlight rectangles if applicable
 */
export function useCitationHighlight(
  citation: Citation | null,
  textLayerRef: HTMLElement | null,
  currentPageNumber: number
): HighlightResult | null {
  const [highlightResult, setHighlightResult] = useState<HighlightResult | null>(null);
  const [pageTextMap, setPageTextMap] = useState<PageTextMap | null>(null);

  // Build page text map when text layer is available
  useEffect(() => {
    if (!textLayerRef) {
      setPageTextMap(null);
      return;
    }

    // Debounce to allow text layer to fully render
    const timeoutId = setTimeout(() => {
      const map = buildPageTextMap(textLayerRef);
      setPageTextMap(map);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [textLayerRef, currentPageNumber]);

  // Calculate highlight rects when citation or page text map changes
  const calculateHighlight = useCallback(() => {
    if (!citation || !pageTextMap || citation.pageNumber !== currentPageNumber) {
      setHighlightResult(null);
      return;
    }

    try {
      const rects = calculateHighlightRects(
        pageTextMap,
        citation.offsetStart,
        citation.offsetEnd
      );

      setHighlightResult({
        rects,
        pageNumber: currentPageNumber,
      });
    } catch (error) {
      console.error('Failed to calculate highlight:', error);
      setHighlightResult(null);
    }
  }, [citation, pageTextMap, currentPageNumber]);

  useEffect(() => {
    calculateHighlight();
  }, [calculateHighlight]);

  return highlightResult;
}
