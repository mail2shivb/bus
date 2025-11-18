
import React,{useEffect,useRef,useState}from "react";
import * as pdfjs from "pdfjs-dist";
import "./pdfWorker";
import { getPdfAsync } from "./authenticatedFetch";
import { buildCharMap, rectsForRange } from "./lib/pdfTextIndex";
import type { HighlightInstruction, HighlightRect, CharBox } from "./types";

interface Props {
  fileName:string|null;
  citation:HighlightInstruction|null;
}

export function PdfViewer({fileName,citation}:Props){
  const [pdfDoc,setPdfDoc]=useState<any>(null);
  const [numPages,setNumPages]=useState(0);
  const [loadedFile,setLoadedFile]=useState<string|null>(null);
  const [rects,setRects]=useState<HighlightRect[]>([]);
  const scale=1.35;

  const pageRefs=useRef<(HTMLDivElement|null)[]>([]);

  // fetch only if new file
  useEffect(()=>{
    if(!fileName) return;
    if(loadedFile===fileName && pdfDoc) return; // cached

    let cancelled=false;
    (async()=>{
      const data=await getPdfAsync(fileName);
      const doc=await pdfjs.getDocument({data}).promise;
      if(cancelled) return;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setLoadedFile(fileName);
      setRects([]);
    })();
    return()=>{cancelled=true};
  },[fileName]);

  // build highlight rects
  useEffect(()=>{
    if(!pdfDoc || !citation || citation.fileName!==fileName) return;
    let cancel=false;
    (async()=>{
      const idx=citation.pageNumber-1;
      if(idx<0||idx>=pdfDoc.numPages) return;
      const chars:CharBox[]=await buildCharMap(pdfDoc,idx);
      if(cancel) return;
      const r=rectsForRange(chars,citation.offsetStart,citation.offsetEnd)
            .map(x=>({...x,id:citation.id}));
      setRects(r);
    })();
    return()=>{cancel=true};
  },[pdfDoc,citation,fileName]);

  // scroll to page
  useEffect(()=>{
    if(!citation||!rects.length) return;
    const idx=citation.pageNumber-1;
    const el=pageRefs.current[idx];
    if(el) el.scrollIntoView({behavior:"smooth",block:"center"});
  },[citation,rects]);

  return <div style={{height:"100%",overflow:"auto",padding:20,scrollBehavior:"smooth"}}>
    {pdfDoc? Array.from({length:numPages},(_,i)=>i+1).map(p=>
      <PageView
        key={p}
        pdfDoc={pdfDoc}
        pageNumber={p}
        scale={scale}
        rects={rects.filter(r=>r.pageIndex===p-1)}
        refEl={el=>pageRefs.current[p-1]=el}
      />
    ):"Loading..."}
  </div>;
}

function PageView({pdfDoc,pageNumber,scale,rects,refEl}:{pdfDoc:any,pageNumber:number,scale:number,rects:HighlightRect[],refEl:(el:HTMLDivElement|null)=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{
    let cancel=false;
    (async()=>{
      const page=await pdfDoc.getPage(pageNumber);
      if(cancel) return;
      const v=page.getViewport({scale});
      const canvas=canvasRef.current;
      if(!canvas) return;
      const ctx=canvas.getContext("2d");
      canvas.width=v.width;
      canvas.height=v.height;
      await page.render({canvasContext:ctx!,viewport:v}).promise;
    })();
    return()=>{cancel=true};
  },[pdfDoc,pageNumber,scale]);

  return (
    <div ref={refEl} style={{position:"relative",margin:"20px auto",width:"fit-content"}}>
      <canvas ref={canvasRef}/>
      {/* highlights */}
      {rects.map(r=>{
        const left=(r.x*scale);
        const top=(r.y*scale);
        const width=(r.width*scale);
        const height=(r.height*scale);

        return (
          <div key={r.id}
            style={{
              position:"absolute",
              left, top, width, height,
              background:"rgba(255,255,0,0.35)",
              pointerEvents:"none"
            }}
          />
        );
      })}
    </div>
  );
}
