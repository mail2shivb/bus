export interface HighlightInstruction {
  id: string;
  fileName: string;
  pageNumber: number;   // 1-based
  offsetStart: number;  // inclusive char offset within that page
  offsetEnd: number;    // exclusive
}

export interface HighlightRect {
  id: string;
  pageIndex: number; // 0-based
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
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
