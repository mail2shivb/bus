export interface HighlightInstruction {
  id: string;
  fileName: string;
  pageNumber: number;   // 1-based
  offsetStart: number;  // inclusive
  offsetEnd: number;    // exclusive
  label?: string;
  color?: string;
}

export interface HighlightRect {
  id: string;
  citationId: string;
  pageIndex: number; // 0-based
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  color?: string;
}

export interface CharBox {
  char: string;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  globalIndex: number;
}

export interface OutlineItem {
  id: string;
  title: string;
  pageNumber: number;
}
