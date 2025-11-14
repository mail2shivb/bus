# Option A – FE-first pdf.js Citation Viewer

Contains:

- `pdf-citation-backend` – Spring Boot backend (serves `/api/pdf?fileName=...`)
- `pdf-citation-frontend` – React + Vite + pdf.js frontend

## Backend

```bash
cd pdf-citation-backend
mvn spring-boot:run
```

Put your PDFs into `pdfs/` (e.g. `Citi10K.pdf`).

## Frontend

```bash
cd pdf-citation-frontend
npm install
npm run dev
```

Open http://localhost:5173, enter the file name, navigate pages, and type a search text to highlight.
