import React, { useState } from "react";
import { PdfViewer } from "./PdfViewer";
import type { HighlightInstruction } from "./types";

const DEMO: HighlightInstruction[] = [
  {
    id: "one",
    fileName: "Citi10K.pdf",
    pageNumber: 2,
    offsetStart: 10,
    offsetEnd: 80,
  },
  {
    id: "two",
    fileName: "sample.pdf",
    pageNumber: 5,
    offsetStart: 40,
    offsetEnd: 160,
  },
];

export default function App() {
  const [sel, setSel] = useState<HighlightInstruction | null>(null);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 250, borderRight: "1px solid #ccc", padding: 10 }}>
        <h3>Citations</h3>
        {DEMO.map((c) => (
          <div
            key={c.id}
            onClick={() => setSel(c)}
            style={{
              padding: 10,
              marginBottom: 6,
              cursor: "pointer",
              border: "1px solid #ddd",
            }}
          >
            {c.id} (Page {c.pageNumber})
          </div>
        ))}
      </aside>
      <main style={{ flex: 1 }}>
        <PdfViewer fileName={sel?.fileName || null} citation={sel} />
      </main>
    </div>
  );
}
