import { useEffect, useRef } from 'react';
import { useCitationContext } from '../context/CitationContext';
import { useCitationHighlight } from '../hooks/useCitationHighlight';
import { HighlightLayer } from './HighlightLayer';

interface PDFCitationPageProps {
  pageNumber: number;
  pageContainer: HTMLElement;
}

/**
 * Component responsible for rendering highlights on a specific PDF page.
 * Only computes highlights when the page matches the active citation.
 */
export function PDFCitationPage({ pageNumber, pageContainer }: PDFCitationPageProps) {
  const { activeCitation } = useCitationContext();
  const textLayerRef = useRef<HTMLElement | null>(null);
  const highlightContainerRef = useRef<HTMLDivElement>(null);

  // Find text layer within page container
  useEffect(() => {
    const textLayer = pageContainer.querySelector('.rpv-core__text-layer') as HTMLElement;
    textLayerRef.current = textLayer;
  }, [pageContainer]);

  // Get highlight rects for this page
  const highlightResult = useCitationHighlight(
    activeCitation,
    textLayerRef.current,
    pageNumber
  );

  // Scroll to highlight when it appears
  useEffect(() => {
    if (highlightResult && highlightResult.rects.length > 0 && highlightContainerRef.current) {
      const firstHighlight = highlightContainerRef.current.querySelector('.highlight-rect');
      if (firstHighlight) {
        setTimeout(() => {
          firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      }
    }
  }, [highlightResult]);

  if (!activeCitation || activeCitation.pageNumber !== pageNumber || !highlightResult) {
    return null;
  }

  return (
    <div
      ref={highlightContainerRef}
      className="pdf-citation-page-highlights"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <HighlightLayer
        rects={highlightResult.rects}
        pageNumber={pageNumber}
        offsetStart={activeCitation.offsetStart}
        offsetEnd={activeCitation.offsetEnd}
      />
    </div>
  );
}
