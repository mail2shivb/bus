# Quick Start Guide

This guide will help you get the PDF Citation Viewer up and running quickly.

## Prerequisites

- Node.js 18+ installed
- A backend server serving PDFs at `/api/pdf?filename={filename}`

## Installation

```bash
cd pdf-viewer
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Setting Citations

Open the browser console and use the global API:

```javascript
// Basic citation
window.setActiveCitation({
  filename: 'sample.pdf',
  pageNumber: 1,
  offsetStart: 0,
  offsetEnd: 100
});

// Jump to a specific page with highlight
window.setActiveCitation({
  filename: 'report.pdf',
  pageNumber: 42,
  offsetStart: 500,
  offsetEnd: 750
});

// Clear citation
window.setActiveCitation(null);
```

## Backend Setup Example

Your backend needs to serve PDFs. Here's a minimal Express.js example:

```javascript
// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.get('/api/pdf', (req, res) => {
  const filename = req.query.filename;
  const pdfPath = path.join(__dirname, 'pdfs', filename);
  
  // Validate filename to prevent directory traversal
  if (!filename || filename.includes('..')) {
    return res.status(400).send('Invalid filename');
  }
  
  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).send('PDF not found');
  }
  
  // Send PDF
  res.type('application/pdf');
  res.sendFile(pdfPath);
});

app.listen(8080, () => {
  console.log('PDF server running on http://localhost:8080');
});
```

Or with Spring Boot:

```java
@RestController
@RequestMapping("/api")
public class PdfController {
    
    @GetMapping("/pdf")
    public ResponseEntity<Resource> getPdf(@RequestParam String filename) {
        // Validate filename
        if (filename.contains("..")) {
            return ResponseEntity.badRequest().build();
        }
        
        Path pdfPath = Paths.get("pdfs", filename);
        Resource resource = new FileSystemResource(pdfPath);
        
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .body(resource);
    }
}
```

## Understanding Character Offsets

Character offsets are calculated from the concatenated text of a single page.

Example page text:
```
"Hello World. This is a test document."
```

To highlight "World":
- offsetStart: 6 (position of 'W')
- offsetEnd: 11 (position after 'd')

```javascript
window.setActiveCitation({
  filename: 'sample.pdf',
  pageNumber: 1,
  offsetStart: 6,
  offsetEnd: 11
});
```

### Multi-line Highlights

The system automatically handles text that wraps across lines:

```javascript
// Highlight text from position 100 to 250 (spans multiple lines)
window.setActiveCitation({
  filename: 'document.pdf',
  pageNumber: 5,
  offsetStart: 100,
  offsetEnd: 250
});
```

## Integrating with Your Application

### React Integration

```typescript
import { useCitationContext } from './context/CitationContext';

function CitationList({ citations }) {
  const { setActiveCitation } = useCitationContext();
  
  return (
    <div>
      {citations.map((citation, index) => (
        <button
          key={index}
          onClick={() => setActiveCitation(citation)}
        >
          Page {citation.pageNumber}: {citation.offsetStart}-{citation.offsetEnd}
        </button>
      ))}
    </div>
  );
}
```

### External State Management

```typescript
import { Citation } from './lib/types';

// Redux action
const setActiveCitation = (citation: Citation) => ({
  type: 'SET_ACTIVE_CITATION',
  payload: citation
});

// Use in component
dispatch(setActiveCitation({
  filename: 'report.pdf',
  pageNumber: 10,
  offsetStart: 200,
  offsetEnd: 300
}));
```

## Common Use Cases

### 1. LLM Citation Viewer

Display citations from LLM responses:

```javascript
// LLM returns citation data
const llmResponse = {
  text: "According to the document...",
  citation: {
    filename: "source.pdf",
    pageNumber: 15,
    offsetStart: 450,
    offsetEnd: 523
  }
};

// Show the citation
window.setActiveCitation(llmResponse.citation);
```

### 2. Search Results

Highlight search results in PDFs:

```javascript
// Search backend returns matches with offsets
const searchResult = {
  query: "risk factors",
  matches: [
    { pageNumber: 5, offsetStart: 120, offsetEnd: 132 },
    { pageNumber: 12, offsetStart: 340, offsetEnd: 352 }
  ]
};

// Show first match
window.setActiveCitation({
  filename: 'report.pdf',
  ...searchResult.matches[0]
});
```

### 3. Document Navigation

Navigate through annotations:

```javascript
const annotations = [
  { pageNumber: 1, offsetStart: 0, offsetEnd: 50 },
  { pageNumber: 3, offsetStart: 100, offsetEnd: 200 },
  { pageNumber: 7, offsetStart: 300, offsetEnd: 400 }
];

let currentIndex = 0;

function nextAnnotation() {
  currentIndex = (currentIndex + 1) % annotations.length;
  window.setActiveCitation({
    filename: 'document.pdf',
    ...annotations[currentIndex]
  });
}

function previousAnnotation() {
  currentIndex = (currentIndex - 1 + annotations.length) % annotations.length;
  window.setActiveCitation({
    filename: 'document.pdf',
    ...annotations[currentIndex]
  });
}
```

## Troubleshooting

### PDF Not Loading

1. Check that backend is running on port 8080
2. Verify `/api/pdf` endpoint is accessible
3. Check browser console for CORS errors
4. Ensure PDF file exists on backend

### Highlight Not Appearing

1. Verify pageNumber is 1-based (first page is 1, not 0)
2. Check that offsets are within page text length
3. Wait for page to fully render before setting citation
4. Check browser console for errors

### Offset Calculation

If highlights appear in wrong position:
1. Extract page text to verify offsets
2. Check for whitespace/newline handling
3. Verify PDF text layer matches expected text order

### Performance Issues

For large PDFs (500+ pages):
1. Ensure backend supports HTTP range requests
2. Check memory usage in browser DevTools
3. Verify virtualization is working (only visible pages rendered)

## Production Build

```bash
npm run build
```

Output will be in `dist/` directory. Serve with any static file server:

```bash
npm install -g serve
serve -s dist -p 3000
```

Or deploy to:
- Vercel: `vercel deploy`
- Netlify: `netlify deploy --prod --dir=dist`
- AWS S3: `aws s3 sync dist/ s3://your-bucket/`

## Next Steps

- Read [README.md](./README.md) for detailed architecture
- Review [SECURITY.md](./SECURITY.md) for security considerations
- Check [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details
- Explore the source code in `src/` directory

## Support

For issues or questions, open an issue in the repository.
