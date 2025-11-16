# Advanced Citation PDF Viewer

A standalone React + TypeScript + Vite application that implements an advanced citation PDF viewer with precise text highlighting capabilities.

## Features

- **Efficient PDF Rendering**: Uses `@react-pdf-viewer/core` for virtualized, lazy rendering of large PDFs
- **Precise Citation Highlighting**: Highlights text based on character offsets within a page's text layer
- **Smooth Scrolling**: Automatically scrolls to highlighted citations
- **Accessibility**: ARIA live regions announce highlights for screen readers
- **Desktop-Focused**: Optimized for desktop viewing (mobile responsive layout not included)
- **Minimal UI**: No toolbars, badges, or thumbnails - clean, distraction-free interface

## Setup

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will start on `http://localhost:3000`.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Backend Requirements

The viewer expects a backend endpoint that serves PDF files:

```
GET /api/pdf?filename={filename}
```

The endpoint should return the PDF file as a binary blob with appropriate content-type headers.

The Vite dev server is configured to proxy `/api` requests to `http://localhost:8080` by default. You can modify this in `vite.config.ts`.

## Usage

### Citation Data Shape

Citations are defined using the `Citation` interface:

```typescript
interface Citation {
  filename: string;      // Name of the PDF file
  pageNumber: number;    // 1-based page number
  offsetStart: number;   // Character offset where citation starts
  offsetEnd: number;     // Character offset where citation ends
}
```

**Important Notes:**
- `pageNumber` is 1-based (first page is 1, not 0)
- `offsetStart` and `offsetEnd` are character offsets within the **concatenated text of that specific page**
- The text layer concatenates all text spans in reading order
- Offsets are 0-based within the page text

### Setting Active Citation

You can set citations programmatically via the browser console:

```javascript
window.setActiveCitation({
  filename: 'document.pdf',
  pageNumber: 5,
  offsetStart: 100,
  offsetEnd: 250
});
```

Or integrate with your application by importing and using the `CitationContext`:

```typescript
import { useCitationContext } from './context/CitationContext';

function YourComponent() {
  const { setActiveCitation } = useCitationContext();
  
  const handleCitationClick = (citation) => {
    setActiveCitation(citation);
  };
  
  // ...
}
```

## How Highlighting Works

### Text Layer Extraction

1. When a PDF page is rendered, `@react-pdf-viewer/core` creates a text layer with individual text spans
2. Each span is a `<span role="presentation">` element containing a portion of the page text
3. The viewer waits for the text layer to fully render before processing

### Offset Mapping

The highlighting system works through these steps:

1. **Build Page Text Map** (`buildPageTextMap`):
   - Queries all text spans from the rendered text layer
   - Concatenates text content in order
   - Tracks cumulative character offsets for each span

2. **Calculate Intersection** (`calculateHighlightRects`):
   - Finds which text spans intersect with the citation offset range
   - For each intersecting span, determines the exact character range to highlight

3. **Compute Rectangles**:
   - For full-span highlights: Uses `getBoundingClientRect()` directly
   - For partial-span highlights: Uses the DOM `Range` API to get precise character-level rectangles
   - Handles text wrapping by collecting multiple rectangles from `getClientRects()`
   - Falls back to proportional estimation if Range API fails

4. **Render Overlays**:
   - Creates absolutely positioned `<div>` elements for each rectangle
   - Positions relative to the text layer container
   - Yellow semi-transparent background (`rgba(255, 255, 0, 0.3)`)

### Scrolling Behavior

When a citation is activated:
1. The viewer scrolls to the target page
2. Once the page renders and highlights are computed, it scrolls the first highlight into view
3. Uses `scrollIntoView({ behavior: 'smooth', block: 'center' })` for smooth UX

## Architecture

### Directory Structure

```
pdf-viewer/
├── src/
│   ├── components/
│   │   ├── CitationViewer.tsx      # Main PDF viewer wrapper
│   │   ├── PDFCitationPage.tsx     # Per-page highlight manager
│   │   ├── HighlightLayer.tsx      # Renders highlight rectangles
│   │   └── LiveRegion.tsx          # Accessibility announcements
│   ├── context/
│   │   └── CitationContext.tsx     # Citation state management
│   ├── hooks/
│   │   ├── usePdfFetch.ts          # PDF file fetching
│   │   └── useCitationHighlight.ts # Highlight computation
│   ├── lib/
│   │   ├── types.ts                # TypeScript interfaces
│   │   └── offsetMapping.ts        # Core highlighting logic
│   ├── styles/
│   │   └── base.css                # Application styles
│   ├── App.tsx                     # Root application component
│   └── main.tsx                    # Application entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Key Components

- **CitationViewer**: Wraps the PDF viewer and manages page tracking
- **PDFCitationPage**: Computes highlights for a specific page when it matches the active citation
- **HighlightLayer**: Renders overlay rectangles for highlights
- **LiveRegion**: Provides screen reader announcements

### Custom Hooks

- **usePdfFetch**: Fetches PDF files from the backend, returns blob URL
- **useCitationHighlight**: Computes highlight rectangles for a given citation and page

### Context

- **CitationContext**: Manages the currently active citation state across components

## Performance Considerations

### Virtualization

- `@react-pdf-viewer/core` handles virtualization internally
- Only visible pages are rendered, keeping memory usage low even for large PDFs

### Selective Highlighting

- Highlights are only computed for pages matching the active citation's page number
- When citation changes, only the target page re-computes highlights
- Non-citation pages render without any highlight processing overhead

### Debouncing

- Text layer parsing is debounced (100ms) to ensure the DOM has fully rendered
- Prevents premature offset calculations

### Caching

- PDF blob URLs are cached in state to avoid re-fetching
- Page text maps are cached per render cycle
- Highlight rectangles are memoized until citation or page changes

## Accessibility

### ARIA Support

- Highlight overlays have `role="note"` and descriptive `aria-label`
- First highlight in a group is keyboard-focusable (`tabIndex={0}`)
- Live region announces citations: "Citation highlighted on page X (offset Y–Z)"

### Keyboard Navigation

- First highlight rectangle can receive focus via Tab key
- Focus outline visible for accessibility
- Standard PDF viewer keyboard shortcuts work (arrow keys, page up/down, etc.)

## Extensibility

### Multiple Citations (Future)

The current implementation supports a single active citation but is structured to allow multiple citations:

```typescript
// Current: Single citation
activeCitation: Citation | null

// Future: Multiple citations
activeCitations: Citation[]
highlightedCitationId: string | null
```

### Export Highlighted Text (Future)

Add a function to extract the highlighted text:

```typescript
function extractCitationText(citation: Citation, pageTextMap: PageTextMap): string {
  return pageTextMap.fullText.substring(
    citation.offsetStart,
    citation.offsetEnd
  );
}
```

### Selection to Citation (Future)

Add user text selection capabilities:

```typescript
function selectionToCitation(selection: Selection, pageNumber: number): Citation {
  // Map DOM selection to character offsets
  // Return new Citation object
}
```

### Custom Highlight Colors

Extend `Citation` interface to support color customization:

```typescript
interface Citation {
  // ... existing fields
  highlightColor?: string; // e.g., 'rgba(255, 255, 0, 0.3)'
}
```

## Testing

### Manual Testing

1. Start the dev server: `npm run dev`
2. Open browser console
3. Set a test citation:
   ```javascript
   window.setActiveCitation({
     filename: 'sample.pdf',
     pageNumber: 1,
     offsetStart: 0,
     offsetEnd: 100
   });
   ```
4. Verify:
   - PDF loads and displays
   - Yellow highlight appears on the correct text
   - Viewer scrolls to the highlight
   - Status bar shows citation info

### Large PDF Testing

Test with documents of 300+ pages:
1. Load a large PDF
2. Set citations on various pages (beginning, middle, end)
3. Verify:
   - Smooth scrolling to target pages
   - No lag when switching citations
   - Memory usage remains stable

### Edge Cases to Test

- **Empty offsets**: `offsetStart === offsetEnd` (should show no highlight)
- **Out of range offsets**: Offsets beyond page text length
- **Multi-line highlights**: Offsets spanning multiple text lines
- **Wrapped text**: Text that wraps across lines
- **Special characters**: Unicode, emojis, RTL text
- **Page boundaries**: Last character on a page

## Limitations & Known Issues

### Character Offset Precision

- Offset mapping depends on how pdf.js extracts the text layer
- Some PDFs with complex layouts may have slight misalignments
- OCR-generated PDFs may have unpredictable text ordering

### Range API Fallback

- If the browser's Range API fails, the system falls back to proportional estimation
- This may be less accurate for variable-width fonts
- A warning is logged to console when fallback occurs

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge) fully supported
- Older browsers may not support all features (Range API, smooth scrolling)
- Internet Explorer is not supported

## Dependencies & Licensing

All dependencies use permissive licenses (MIT or Apache 2.0):

- **React** (MIT): UI framework
- **@react-pdf-viewer/core** (MIT): PDF rendering
- **pdfjs-dist** (Apache 2.0): PDF.js library (transitive)
- **TypeScript** (Apache 2.0): Type safety
- **Vite** (MIT): Build tool

## Contributing

When extending this viewer:

1. Maintain separation between offset mapping and rendering layers
2. Keep components focused and single-purpose
3. Add JSDoc comments for exported functions
4. Update this README with new features
5. Test with various PDF types and sizes

## Future Roadmap

- [ ] Support for multiple simultaneous citations
- [ ] Citation annotation export (JSON, CSV)
- [ ] Text selection to create new citations
- [ ] Custom highlight colors per citation
- [ ] Citation comparison view (side-by-side)
- [ ] Search within citations
- [ ] Citation metadata (notes, tags, timestamps)
- [ ] Mobile responsive layout
- [ ] Offline support with service workers
- [ ] PDF annotation capabilities

## License

This project is part of the `mail2shivb/bus` repository. See the repository's main LICENSE file for details.

## Support

For issues, questions, or feature requests, please open an issue in the `mail2shivb/bus` repository.
