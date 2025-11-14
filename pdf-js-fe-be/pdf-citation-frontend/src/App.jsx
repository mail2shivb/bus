import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?worker&url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API = "http://localhost:8080/api";

export default function App() {
  const [fileName, setFileName] = useState("Citi10K.pdf");
  const [pageNumber, setPageNumber] = useState(1);
  const [searchText, setSearchText] = useState("risk factor");
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [status, setStatus] = useState("");

  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);

  // Load PDF when fileName changes
  useEffect(() => {
    (async () => {
      if (!fileName) return;
      setStatus("Loading PDF...");
      try {
        const url = `${API}/pdf?` + new URLSearchParams({ fileName });
        const loadingTask = pdfjsLib.getDocument({
          url,
          rangeChunkSize: 65536
        });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNumber(1);
        setStatus(`Loaded: ${fileName} (${doc.numPages} pages)`);
      } catch (err) {
        console.error(err);
        setStatus("Failed to load PDF. Check filename and backend.");
      }
    })();
  }, [fileName]);

  // Render current page + simple highlight
  useEffect(() => {
    if (!pdfDoc) return;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.3 });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // // Extract text for this page
        // const textContent = await page.getTextContent();
        // const text = textContent.items.map(i => i.str).join(" ");

        // const layer = textLayerRef.current;
        // layer.innerHTML = "";
        // const div = document.createElement("div");
        // div.style.whiteSpace = "pre-wrap";
        // div.style.fontFamily = "system-ui, sans-serif";
        // div.style.fontSize = "12px";

        // if (searchText) {
        //   const esc = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        //   const re = new RegExp(esc, "gi");
        //   div.innerHTML = text.replace(re, match => `<mark>${match}</mark>`);
        // } else {
        //   div.textContent = text;
        // }

        // layer.appendChild(div);
      } catch (err) {
        console.error(err);
        setStatus("Failed to render page.");
      }
    })();
  }, [pdfDoc, pageNumber, searchText]);

  const canPrev = pageNumber > 1;
  const canNext = numPages && pageNumber < numPages;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h2>Option A – FE-first pdf.js Citation Viewer</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          style={{ flex: 1, minWidth: 180 }}
          value={fileName}
          onChange={e => setFileName(e.target.value)}
          placeholder="fileName (must exist in backend /pdfs)"
        />
        <input
          style={{ width: 80 }}
          type="number"
          min={1}
          max={numPages || 1}
          value={pageNumber}
          onChange={e =>
            setPageNumber(
              Math.min(Math.max(1, Number(e.target.value || 1)), numPages || 1)
            )
          }
        />
        <div>
          <button disabled={!canPrev} onClick={() => canPrev && setPageNumber(p => p - 1)}>
            ◀ Prev
          </button>
          <button
            disabled={!canNext}
            onClick={() => canNext && setPageNumber(p => p + 1)}
            style={{ marginLeft: 4 }}
          >
            Next ▶
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          style={{ flex: 1 }}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search text / paragraph for highlight"
        />
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
        {status || "Idle"} | Page {pageNumber} / {numPages || "-"}
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#111",
          maxHeight: "80vh",
          overflow: "auto",
          position: "relative"
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", margin: "0 auto" }} />
        <div
          ref={textLayerRef}
          style={{
            position: "absolute",
            inset: 0,
            color: "#fff",
            padding: 16,
            pointerEvents: "none",
            overflow: "hidden"
          }}
        />
      </div>
    </div>
  );
}
