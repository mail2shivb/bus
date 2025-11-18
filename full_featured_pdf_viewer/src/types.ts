
export interface HighlightInstruction {
  id: string;
  fileName: string;
  pageNumber: number;
  offsetStart: number;
  offsetEnd: number;
}
export interface HighlightRect {
  id: string;
  pageIndex: number;
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
