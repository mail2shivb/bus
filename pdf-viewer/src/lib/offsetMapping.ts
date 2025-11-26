import { PageTextMap, Rect, TextSpan } from './types';

/**
 * Builds a text map from the text layer div elements.
 * Concatenates all text spans in order and tracks their cumulative offsets.
 * 
 * @param textLayer - The text layer container element
 * @returns PageTextMap with full text and span information
 */
export function buildPageTextMap(textLayer: HTMLElement | null): PageTextMap {
  if (!textLayer) {
    return { fullText: '', spans: [] };
  }

  const spans: TextSpan[] = [];
  let cumulativeOffset = 0;
  let fullText = '';

  // Find all text spans within the text layer
  const textElements = textLayer.querySelectorAll('span[role="presentation"]');
  
  textElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    const text = htmlElement.textContent || '';
    
    if (text.length > 0) {
      const span: TextSpan = {
        element: htmlElement,
        text,
        startOffset: cumulativeOffset,
        endOffset: cumulativeOffset + text.length,
      };
      
      spans.push(span);
      fullText += text;
      cumulativeOffset += text.length;
    }
  });

  return { fullText, spans };
}

/**
 * Calculates highlight rectangles for a given offset range.
 * Handles partial span highlighting and text wrapping.
 * 
 * @param map - The page text map
 * @param offsetStart - Start offset in concatenated text
 * @param offsetEnd - End offset in concatenated text
 * @returns Array of rectangles for highlighting
 */
export function calculateHighlightRects(
  map: PageTextMap,
  offsetStart: number,
  offsetEnd: number
): Rect[] {
  const rects: Rect[] = [];

  // Find spans that intersect with the target range
  const intersectingSpans = map.spans.filter(
    (span) => span.endOffset > offsetStart && span.startOffset < offsetEnd
  );

  intersectingSpans.forEach((span) => {
    const { element, startOffset, text } = span;

    // Calculate the intersection range within this span
    const rangeStart = Math.max(0, offsetStart - startOffset);
    const rangeEnd = Math.min(text.length, offsetEnd - startOffset);

    // Get bounding rectangles for the intersection
    const spanRects = getTextRangeRects(element, text, rangeStart, rangeEnd);
    rects.push(...spanRects);
  });

  return rects;
}

/**
 * Gets bounding rectangles for a text range within an element.
 * Handles partial text selection within a span.
 * 
 * @param element - The HTML element containing the text
 * @param text - The full text content
 * @param rangeStart - Start index within the text
 * @param rangeEnd - End index within the text
 * @returns Array of rectangles
 */
function getTextRangeRects(
  element: HTMLElement,
  text: string,
  rangeStart: number,
  rangeEnd: number
): Rect[] {
  const rects: Rect[] = [];

  // If highlighting the entire span, use element bounds directly
  if (rangeStart === 0 && rangeEnd === text.length) {
    const rect = element.getBoundingClientRect();
    const pageContainer = element.closest('.rpv-core__text-layer');
    
    if (pageContainer) {
      const containerRect = pageContainer.getBoundingClientRect();
      rects.push({
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
    }
    return rects;
  }

  // For partial span highlighting, use Range API
  try {
    const textNode = element.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.setStart(textNode, rangeStart);
      range.setEnd(textNode, rangeEnd);

      const clientRects = range.getClientRects();
      const pageContainer = element.closest('.rpv-core__text-layer');

      if (pageContainer) {
        const containerRect = pageContainer.getBoundingClientRect();
        
        Array.from(clientRects).forEach((rect) => {
          rects.push({
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
          });
        });
      }
    }
  } catch (error) {
    console.warn('Failed to calculate text range rects:', error);
    
    // Fallback: approximate using proportional positioning
    const rect = element.getBoundingClientRect();
    const pageContainer = element.closest('.rpv-core__text-layer');
    
    if (pageContainer) {
      const containerRect = pageContainer.getBoundingClientRect();
      const charWidth = rect.width / text.length;
      
      rects.push({
        x: rect.left - containerRect.left + (rangeStart * charWidth),
        y: rect.top - containerRect.top,
        width: (rangeEnd - rangeStart) * charWidth,
        height: rect.height,
      });
    }
  }

  return rects;
}
