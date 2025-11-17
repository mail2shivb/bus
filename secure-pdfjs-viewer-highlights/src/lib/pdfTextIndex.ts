import type { PDFDocumentProxy } from "pdfjs-dist";
import type { CharBox, HighlightRect } from "../types";

type TextItem = {
  str: string;
  width: number;
  transform: number[];
};

type TextContent = {
  items: TextItem[];
};

export async function buildCharMap(
  doc: PDFDocumentProxy,
  pageIndex: number
): Promise<CharBox[]> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = (await page.getTextContent()) as TextContent;

  const charBoxes: CharBox[] = [];
  let globalIndex = 0;

  for (const item of textContent.items) {
    const str = item.str;
    if (!str) continue;

    const transform = item.transform;
    const fontHeight = Math.abs(transform[3]);

    let x = transform[4];
    const y = viewport.height - transform[5] - fontHeight;

    const totalWidth = item.width || 0;
    const charWidth = str.length > 0 ? totalWidth / str.length : 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      charBoxes.push({
        char: ch,
        pageIndex,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        x,
        y,
        width: charWidth,
        height: fontHeight,
        globalIndex
      });
      x += charWidth;
      globalIndex++;
    }
  }

  return charBoxes;
}

export function rectsForRange(
  charBoxes: CharBox[],
  startOffset: number,
  endOffset: number
): HighlightRect[] {
  const slice = charBoxes.filter(
    (c) => c.globalIndex >= startOffset && c.globalIndex < endOffset
  );

  if (!slice.length) return [];

  const rects: HighlightRect[] = [];
  const lineTolerance = 2;
  const pageWidth = slice[0].pageWidth;
  const pageHeight = slice[0].pageHeight;

  slice.forEach((c) => {
    const line = rects.find(
      (r) =>
        r.pageIndex === c.pageIndex &&
        Math.abs(r.y - c.y) <= lineTolerance
    );

    if (!line) {
      rects.push({
        id: "",
        pageIndex: c.pageIndex,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
        pageWidth,
        pageHeight
      });
    } else {
      const right = Math.max(line.x + line.width, c.x + c.width);
      line.x = Math.min(line.x, c.x);
      line.width = right - line.x;
      line.y = Math.min(line.y, c.y);
      line.height = Math.max(line.height, c.height);
    }
  });

  return rects;
}
