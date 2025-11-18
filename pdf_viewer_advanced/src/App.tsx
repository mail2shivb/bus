import React, { useMemo, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import type { HighlightInstruction, OutlineItem } from "./types";
import "./index.css";

const INITIAL_CITATIONS: HighlightInstruction[] = [
  {
    id: "c1",
    fileName: "sample.pdf",
    pageNumber: 2,
    offsetStart: 10,
    offsetEnd: 120,
    label: "Intro section on page 2"
  },
  {
    id: "c2",
    fileName: "sample.pdf",
    pageNumber: 5,
    offsetStart: 40,
    offsetEnd: 180,
    label: "Key risk factors on page 5"
  }
];

export default function App() {
  const [citations, setCitations] = useState<HighlightInstruction[]>(INITIAL_CITATIONS);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(citations[0]?.id ?? null);
  const [highlightColor, setHighlightColor] = useState<string>("#fff59d");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const currentFile = useMemo(() => {
    const active = citations.find((c) => c.id === activeCitationId);
    return active?.fileName ?? (citations[0]?.fileName ?? null);
  }, [citations, activeCitationId]);

  const filteredCitations = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return citations.filter((c) => {
      const label = c.label ?? c.id;
      return (
        label.toLowerCase().includes(lower) ||
        c.fileName.toLowerCase().includes(lower) ||
        String(c.pageNumber).includes(lower)
      );
    });
  }, [citations, searchTerm]);

  const currentFileCitations = useMemo(
    () => citations.filter((c) => c.fileName === currentFile),
    [citations, currentFile]
  );

  const activeIndex = currentFileCitations.findIndex((c) => c.id === activeCitationId);

  const goToNextCitation = () => {
    if (!currentFileCitations.length) return;
    const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % currentFileCitations.length : 0;
    setActiveCitationId(currentFileCitations[nextIndex].id);
  };

  const goToPrevCitation = () => {
    if (!currentFileCitations.length) return;
    const prevIndex =
      activeIndex > 0 ? activeIndex - 1 : currentFileCitations.length - 1;
    setActiveCitationId(currentFileCitations[prevIndex].id);
  };

  const handleCreateHighlight = (h: HighlightInstruction) => {
    const labeled: HighlightInstruction = {
      ...h,
      label: h.label ?? `User highlight (Page ${h.pageNumber})`,
      color: highlightColor
    };
    setCitations((prev) => [...prev, labeled]);
    setActiveCitationId(labeled.id);
  };

  const handleOutlineLoaded = (items: OutlineItem[]) => {
    setOutline(items);
  };

  const handleJumpFormSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const fileName = (data.get("fileName") as string) || currentFile || "";
    const pageNumber = Number(data.get("pageNumber"));
    const offsetStart = Number(data.get("offsetStart"));
    const offsetEnd = Number(data.get("offsetEnd"));
    if (!fileName || !pageNumber || isNaN(offsetStart) || isNaN(offsetEnd)) {
      return;
    }
    const id = `jump-${Date.now()}`;
    const h: HighlightInstruction = {
      id,
      fileName,
      pageNumber,
      offsetStart,
      offsetEnd,
      label: `Manual jump p${pageNumber} [${offsetStart}-${offsetEnd}]`,
      color: highlightColor
    };
    setCitations((prev) => [...prev, h]);
    setActiveCitationId(id);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 320,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          padding: 12,
          boxSizing: "border-box",
          fontSize: 13
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Citations</h3>

        <input
          type="text"
          placeholder="Search citations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid #d1d5db",
            marginBottom: 8
          }}
        />

        <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={goToPrevCitation}
            style={{
              flex: 1,
              padding: "4px 6px",
              borderRadius: 4,
              border: "1px solid #d1d5db",
              cursor: "pointer"
            }}
          >
            ◀ Prev
          </button>
          <button
            type="button"
            onClick={goToNextCitation}
            style={{
              flex: 1,
              padding: "4px 6px",
              borderRadius: 4,
              border: "1px solid #d1d5db",
              cursor: "pointer"
            }}
          >
            Next ▶
          </button>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, marginRight: 6 }}>Highlight color:</label>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: 4,
            border: "1px solid #e5e7eb",
            borderRadius: 4
          }}
        >
          {filteredCitations.length ? (
            filteredCitations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCitationId(c.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "none",
                  borderBottom: "1px solid #f3f4f6",
                  backgroundColor:
                    c.id === activeCitationId ? "#2563eb" : "transparent",
                  color: c.id === activeCitationId ? "#ffffff" : "#111827",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {c.label || c.id}{" "}
                  <span style={{ opacity: 0.7 }}>
                    (p{c.pageNumber}, {c.offsetStart}-{c.offsetEnd})
                  </span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{c.fileName}</div>
              </button>
            ))
          ) : (
            <div style={{ padding: 8, color: "#6b7280" }}>No citations.</div>
          )}
        </div>

        {/* Manual jump form */}
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Jump to offset</div>
          <form onSubmit={handleJumpFormSubmit} style={{ display: "grid", gap: 4 }}>
            <input
              name="fileName"
              placeholder={currentFile || "fileName.pdf"}
              defaultValue={currentFile || ""}
              style={{ padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4 }}
            />
            <input
              name="pageNumber"
              placeholder="Page"
              type="number"
              min={1}
              style={{ padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4 }}
            />
            <input
              name="offsetStart"
              placeholder="Offset start"
              type="number"
              style={{ padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4 }}
            />
            <input
              name="offsetEnd"
              placeholder="Offset end"
              type="number"
              style={{ padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4 }}
            />
            <button
              type="submit"
              style={{
                marginTop: 4,
                padding: "3px 6px",
                borderRadius: 4,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              Jump
            </button>
          </form>
        </div>

        {/* Outline */}
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Document outline</div>
          <div
            style={{
              maxHeight: 160,
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 4
            }}
          >
            {outline.length ? (
              outline.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    const id = `outline-${o.pageNumber}-${Date.now()}`;
                    const h: HighlightInstruction = {
                      id,
                      fileName: currentFile || o.title, // fallback
                      pageNumber: o.pageNumber,
                      offsetStart: 0,
                      offsetEnd: 1,
                      label: o.title,
                      color: highlightColor
                    };
                    setCitations((prev) => [...prev, h]);
                    setActiveCitationId(id);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "4px 6px",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    background: "transparent",
                    cursor: "pointer"
                  }}
                >
                  Page {o.pageNumber}: {o.title}
                </button>
              ))
            ) : (
              <div style={{ padding: 6, color: "#6b7280" }}>No outline detected.</div>
            )}
          </div>
        </div>
      </aside>

      {/* Main viewer */}
      <main style={{ flex: 1 }}>
        <PdfViewer
          fileName={currentFile}
          citations={citations}
          activeCitationId={activeCitationId}
          highlightColor={highlightColor}
          onCreateHighlight={handleCreateHighlight}
          onOutlineLoaded={handleOutlineLoaded}
        />
      </main>
    </div>
  );
}
