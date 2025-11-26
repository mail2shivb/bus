/**
 * Citation type representing a highlighted text range in a PDF document.
 * 
 * @property filename - The name of the PDF file
 * @property pageNumber - 1-based page number where the citation appears
 * @property offsetStart - Character offset where the citation starts (within concatenated page text)
 * @property offsetEnd - Character offset where the citation ends (within concatenated page text)
 */
export interface Citation {
  filename: string;
  pageNumber: number;
  offsetStart: number;
  offsetEnd: number;
}

/**
 * Rectangle definition for highlight overlay positioning.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Text span information from PDF text layer.
 */
export interface TextSpan {
  element: HTMLElement;
  text: string;
  startOffset: number; // cumulative offset in page text
  endOffset: number;   // cumulative offset in page text
}

/**
 * Mapped text information for a single page.
 */
export interface PageTextMap {
  fullText: string;
  spans: TextSpan[];
}
