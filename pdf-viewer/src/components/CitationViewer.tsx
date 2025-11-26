import { useEffect, useState, useCallback } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import { useCitationContext } from '../context/CitationContext';
import { PDFCitationPage } from './PDFCitationPage';

interface CitationViewerProps {
  fileUrl: string;
}

/**
 * Main PDF viewer component with citation highlighting.
 * Wraps @react-pdf-viewer/core and manages page-level highlights.
 */
export function CitationViewer({ fileUrl }: CitationViewerProps) {
  const { activeCitation } = useCitationContext();
  const [pageElements, setPageElements] = useState<Map<number, HTMLElement>>(new Map());

  // Track rendered pages
  const handlePageChange = useCallback(() => {
    // When page changes, we need to wait for the DOM to update
    setTimeout(() => {
      const pageContainers = document.querySelectorAll('.rpv-core__page-layer');
      const newPageElements = new Map<number, HTMLElement>();
      
      pageContainers.forEach((container, index) => {
        const pageNumber = index + 1; // 1-based
        newPageElements.set(pageNumber, container as HTMLElement);
      });
      
      setPageElements(newPageElements);
    }, 100);
  }, []);

  // Initial page load
  const handleDocumentLoad = useCallback(() => {
    setTimeout(() => {
      const pageContainers = document.querySelectorAll('.rpv-core__page-layer');
      const newPageElements = new Map<number, HTMLElement>();
      
      pageContainers.forEach((container, index) => {
        const pageNumber = index + 1; // 1-based
        newPageElements.set(pageNumber, container as HTMLElement);
      });
      
      setPageElements(newPageElements);
    }, 100);
  }, []);

  // Jump to citation page when citation changes
  useEffect(() => {
    if (activeCitation) {
      const viewer = document.querySelector('.rpv-core__viewer');
      if (viewer) {
        // Find the target page element and scroll to it
        const targetPage = viewer.querySelector(
          `.rpv-core__page-layer:nth-child(${activeCitation.pageNumber})`
        );
        
        if (targetPage) {
          setTimeout(() => {
            targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    }
  }, [activeCitation]);

  return (
    <div className="citation-viewer-container">
      <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
        <Viewer
          fileUrl={fileUrl}
          onPageChange={handlePageChange}
          onDocumentLoad={handleDocumentLoad}
        />
      </Worker>

      {/* Render highlight layers for all pages */}
      {Array.from(pageElements.entries()).map(([pageNumber, pageContainer]) => (
        <PDFCitationPage
          key={pageNumber}
          pageNumber={pageNumber}
          pageContainer={pageContainer}
        />
      ))}
    </div>
  );
}
