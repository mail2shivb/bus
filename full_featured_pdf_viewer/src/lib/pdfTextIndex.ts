
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { CharBox, HighlightRect } from "../types";

export async function buildCharMap(doc:PDFDocumentProxy, pageIndex:number):Promise<CharBox[]> {
  const page = await doc.getPage(pageIndex+1);
  const viewport = page.getViewport({scale:1});
  const text = await page.getTextContent();
  const items:any[] = text.items;

  const boxes:CharBox[]=[];
  let i=0;
  for(const item of items){
    const str = item.str;
    if(!str) continue;
    const [a,b,c,d,e,f] = item.transform;
    const fontHeight = Math.abs(d);
    const totalWidth = item.width || 0;
    const cw = totalWidth / str.length;
    let x = e;
    const y = viewport.height - f - fontHeight;

    for(let ch of str){
      boxes.push({char:ch,pageIndex,pageWidth:viewport.width,pageHeight:viewport.height,x,y,width:cw,height:fontHeight,globalIndex:i});
      x+=cw;
      i++;
    }
  }
  return boxes;
}

export function rectsForRange(chars:CharBox[],start:number,end:number):HighlightRect[]{
  const slice=chars.filter(c=>c.globalIndex>=start && c.globalIndex<end);
  if(!slice.length) return [];
  const rects:HighlightRect[]=[];
  const tol=2;
  const pw=slice[0].pageWidth, ph=slice[0].pageHeight;

  for(const c of slice){
    const line=rects.find(r=>Math.abs(r.y-c.y)<=tol);
    if(line){
      const right=Math.max(line.x+line.width,c.x+c.width);
      line.x=Math.min(line.x,c.x);
      line.width=right-line.x;
      line.height=Math.max(line.height,c.height);
    } else {
      rects.push({id:"",pageIndex:c.pageIndex,x:c.x,y:c.y,width:c.width,height:c.height,pageWidth:pw,pageHeight:ph});
    }
  }
  return rects;
}
