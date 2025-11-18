# Advanced PDF.js Citation Viewer

Features:
- Multi-highlight per page based on (fileName, pageNumber, offsetStart, offsetEnd)
- Smooth scroll to active citation
- Highlight blinking / focus via CSS animation
- Sidebar citation search
- Document outline navigation (when outline is available in PDF)
- Next / Previous citation buttons
- Lazy page rendering using IntersectionObserver
- Adjustable highlight color
- Text selection in the page to create a new highlight (offsets computed from text layer)
- Manual "jump to any offset" form

Backend contract:
GET /api/pdf?fileName={fileName}
Authorization: Bearer <token>
Accept: application/pdf

Update `getBearerTokenAsync` in `src/authenticatedFetch.ts` to integrate with UBS auth.
