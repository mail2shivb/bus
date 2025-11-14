import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?worker&url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API = "http://localhost:8080/api";

export default function App() {
  const [fileName, setFileName] = useState("Citi10K.pdf");

  const [searchInput, setSearchInput] = useState("risk factor");
  const [activeQuery, setActiveQuery] = useState("risk factor");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [status, setStatus] = useState("");

  const viewerRef = useRef(null);

  const pulseCss = `
    @keyframes pulse {
      0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(250,204,21,0.8); }
      50%  { transform: scale(1.03); box-shadow: 0 0 8px 4px rgba(250,204,21,0.0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(250,204,21,0); }
    }
    .highlight-active {
      animation: pulse 1.1s ease-in-out infinite;
      border-radius: 3px;
    }
  `;

  // helper: normalize whitespace for searching
  const normalizeForSearch = (s) =>
    s.toLowerCase().replace(/\s+/g, " ").trim();

  // Load PDF
  useEffect(() => {
    (async () => {
      if (!fileName) return;
      setStatus("Loading PDF...");
      setPdfDoc(null);
      setNumPages(0);

      try {
        const url = `${API}/pdf?` + new URLSearchParams({ fileName });
        const loadingTask = pdfjsLib.getDocument({
          url,
          rangeChunkSize: 65536
        });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setStatus(`Loaded ${fileName} (${doc.numPages} pages)`);
      } catch (err) {
        console.error(err);
        setStatus("Failed to load PDF. Check filename and backend.");
      }
    })();
  }, [fileName]);

  // Search across all pages & scroll to first hit
  useEffect(() => {
    if (!pdfDoc) return;
    if (searchTrigger === 0) return;

    const raw = searchInput.trim();
    if (!raw) {
      setActiveQuery("");
      setStatus("Cleared search.");
      return;
    }

    let cancelled = false;

    (async () => {
      setStatus(`Searching for "${raw}"...`);
      const normQuery = normalizeForSearch(raw);
      const total = pdfDoc.numPages;
      let foundPage = null;

      for (let p = 1; p <= total; p++) {
        const page = await pdfDoc.getPage(p);
        if (cancelled) return;

        const textContent = await page.getTextContent();
        const flat = textContent.items.map(i => i.str).join("");
        const normFlat = normalizeForSearch(flat);

        if (normFlat.includes(normQuery)) {
          foundPage = p;
          break;
        }
      }

      if (cancelled) return;

      setActiveQuery(raw);

      if (foundPage != null) {
        setStatus(`Found on page ${foundPage}/${total}`);
        const el = document.getElementById(`page-${foundPage}`);
        if (el && viewerRef.current) {
          const viewer = viewerRef.current;
          const offsetTop = el.offsetTop;
          viewer.scrollTo({ top: offsetTop - 16, behavior: "smooth" });
        }
      } else {
        setStatus(`No match found for "${raw}"`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchTrigger, pdfDoc, searchInput]);

  const handleSearchClick = () => {
    setSearchTrigger(v => v + 1);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f8fafc",
        padding: 16,
        fontFamily: "system-ui",
        boxSizing: "border-box"
      }}
    >
      <style>{pulseCss}</style>

      <h2 style={{ marginTop: 0 }}>PDF Viewer – Continuous Scroll & Highlight</h2>

      <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1, padding: 6 }}
          value={fileName}
          onChange={e => setFileName(e.target.value)}
          placeholder="fileName (must exist in backend /pdfs)"
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <textarea
          style={{
            width: "100%",
            minHeight: 80,
            padding: 8,
            boxSizing: "border-box",
            fontSize: 14
          }}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search text / paragraph to locate & highlight"
        />
        <button
          onClick={handleSearchClick}
          style={{ marginTop: 6, padding: "6px 12px" }}
        >
          Search
        </button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: "#64748b" }}>
        {status || "Idle"} {numPages ? `| Total pages: ${numPages}` : ""}
      </div>

      {/* Continuous scroll viewer */}
      <div style={{ flex: 1, marginTop: 4 }}>
        <div
          ref={viewerRef}
          style={{
            height: "80vh",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "#e2e8f0",
            padding: 16,
            boxSizing: "border-box",
            overflowY: "auto"
          }}
        >
          {pdfDoc &&
            Array.from({ length: numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                pdfDoc={pdfDoc}
                pageNumber={i + 1}
                activeQuery={activeQuery}
                normalizeForSearch={normalizeForSearch}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Single page canvas component (stacked for continuous scroll) ----------
function PdfPage({ pdfDoc, pageNumber, activeQuery, normalizeForSearch }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [rects, setRects] = useState([]);

  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const scale = 1.3;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;

        const queryRaw = (activeQuery || "").trim();
        const queryNorm = normalizeForSearch(queryRaw);
        if (!queryNorm) {
          setRects([]);
          return;
        }

        const textContent = await page.getTextContent();
        if (cancelled) return;

        // --- build flat text + spans ---
        let flat = "";
        const spans = [];
        for (const item of textContent.items) {
          const start = flat.length;
          flat += item.str;
          const end = flat.length;
          spans.push({ item, start, end });
        }

        // --- build normalized text with index mapping ---
        let normFlat = "";
        const normIndexToOrig = []; // norm index -> original index in flat
        let lastWasSpace = false;

        for (let i = 0; i < flat.length; i++) {
          const ch = flat[i];
          if (/\s/.test(ch)) {
            if (!lastWasSpace) {
              normFlat += " ";
              normIndexToOrig.push(i);
              lastWasSpace = true;
            }
          } else {
            normFlat += ch.toLowerCase();
            normIndexToOrig.push(i);
            lastWasSpace = false;
          }
        }

        const query = queryNorm;
        const ranges = [];

        if (query.length > 0) {
          let pos = 0;
          while (true) {
            const idx = normFlat.indexOf(query, pos);
            if (idx === -1) break;
            const normStart = idx;
            const normEnd = idx + query.length;

            const origStart = normIndexToOrig[normStart];
            const origEnd =
              normIndexToOrig[normEnd - 1] + 1; // exclusive

            ranges.push({ start: origStart, end: origEnd });
            pos = normEnd;
          }
        }

        // ---- character-level highlight rects (no whole line) ----
        const rectList = [];
        for (const range of ranges) {
          for (const span of spans) {
            if (span.end < range.start) continue;
            if (span.start > range.end) break;

            const ovStart = Math.max(span.start, range.start);
            const ovEnd = Math.min(span.end, range.end);
            if (ovStart >= ovEnd) continue;

            const it = span.item;
            const text = it.str || "";
            const tr = it.transform; // [a, b, c, d, e, f]
            const x = tr[4];
            const y = tr[5];
            const fontSize = tr[0];

            const spanLen = text.length || 1;
            const localStart = Math.max(0, ovStart - span.start);
            const localEnd = Math.min(spanLen, ovEnd - span.start);
            if (localStart >= localEnd) continue;

            const itemWidthPx = it.width * scale;
            const charWidth = itemWidthPx / spanLen;

            const rectX = x * scale + charWidth * localStart;
            const rectWidth = charWidth * (localEnd - localStart);

            const rectY =
              viewport.height - y * scale - fontSize * scale;
            const rectHeight = fontSize * scale * 1.25;

            rectList.push({
              x: rectX,
              y: rectY,
              width: rectWidth,
              height: rectHeight
            });
          }
        }

        setRects(rectList);
      } catch (err) {
        if (!cancelled) {
          console.error("Render page error", pageNumber, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, activeQuery, normalizeForSearch]);

  return (
    <div
      id={`page-${pageNumber}`}
      style={{
        marginBottom: 24,
        display: "flex",
        justifyContent: "center"
      }}
    >
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          background: "white",
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block"
          }}
        />
        {rects.map((r, i) => (
          <div
            key={i}
            className={i === 0 ? "highlight-active" : ""}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              backgroundColor:
                i === 0
                  ? "rgba(250,204,21,0.75)"
                  : "rgba(255,255,0,0.45)",
              pointerEvents: "none"
            }}
          />
        ))}
      </div>
    </div>
  );
}
