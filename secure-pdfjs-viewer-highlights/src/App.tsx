import React, { useState } from "react";
import { PdfViewer } from "./PdfViewer";
import type { HighlightInstruction } from "./types";

const DEMO_FILE = "Citi10K.pdf";

const DEMO_HIGHLIGHTS: HighlightInstruction[] = [
  {
    id: "h1",
    fileName: DEMO_FILE,
    pageNumber: 1,
    offsetStart: 50,
    offsetEnd: 140,
  },
  {
    id: "h2",
    fileName: DEMO_FILE,
    pageNumber: 2,
    offsetStart: 10,
    offsetEnd: 90,
  },
];

const App: React.FC = () => {
  const [fileName, setFileName] = useState<string>(DEMO_FILE);
  const [currentFile, setCurrentFile] = useState<string>(DEMO_FILE);
  const [activeHighlightId, setActiveHighlightId] = useState<
    string | undefined
  >(DEMO_HIGHLIGHTS[0]?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentFile(fileName.trim());
  };

  const currentHighlights = DEMO_HIGHLIGHTS.filter(
    (h) => h.fileName === currentFile
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* <header
        style={{
          padding: "8px 16px",
          background: "#111827",
          color: "#fff",
          fontSize: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Secure PDF.js Viewer with Highlights</span>
        <span style={{ opacity: 0.75 }}>
          Backend: /api/pdf?fileName=… (authenticated)
        </span>
      </header>

      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            width: 260,
            borderRight: "1px solid #e5e7eb",
            padding: 12,
            boxSizing: "border-box",
            fontSize: 13,
            background: "#f9fafb",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 8, marginBottom: 12 }}
          >
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #d1d5db",
                width: "100%",
              }}
              placeholder="sample.pdf"
            />
            <button
              type="submit"
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Load
            </button>
          </form>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Citations / Highlights
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {currentHighlights.length ? (
              currentHighlights.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setActiveHighlightId(h.id)}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 4,
                    border: "1px solid transparent",
                    cursor: "pointer",
                    background:
                      activeHighlightId === h.id ? "#2563eb" : "transparent",
                    color: activeHighlightId === h.id ? "#fff" : "#111827",
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>Highlight {h.id}</div>
                  <div style={{ opacity: 0.85 }}>
                    Page {h.pageNumber} · offsets {h.offsetStart}–{h.offsetEnd}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                No highlights configured for this file.
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "#4b5563" }}>
            In your real app, this list comes from your backend. Selecting a
            highlight will scroll to the relevant page and show a yellow overlay
            for the text range.
          </div>
        </aside> */}

      <main style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <PdfViewer
          fileName={currentFile}
          highlights={currentHighlights}
          activeHighlightId={activeHighlightId}
        />
      </main>
      {/* </div> */}
    </div>
  );
};

export default App;
