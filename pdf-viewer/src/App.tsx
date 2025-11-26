import { useEffect, useState } from 'react';
import { CitationProvider, useCitationContext } from './context/CitationContext';
import { usePdfFetch } from './hooks/usePdfFetch';
import { CitationViewer } from './components/CitationViewer';
import { LiveRegion } from './components/LiveRegion';
import { Citation } from './lib/types';
import './styles/base.css';

/**
 * Inner app component that uses citation context.
 */
function AppContent() {
  const { activeCitation, setActiveCitation } = useCitationContext();
  const [liveMessage, setLiveMessage] = useState<string>('');

  // For demo/testing: set a sample citation
  // In production, this would come from props or external state management
  useEffect(() => {
    // Example citation - can be updated via window.setActiveCitation in console
    (window as any).setActiveCitation = (citation: Citation) => {
      setActiveCitation(citation);
    };

    // Set initial demo citation (you can remove this in production)
    const demoCitation: Citation = {
      filename: 'sample.pdf',
      pageNumber: 1,
      offsetStart: 0,
      offsetEnd: 50,
    };
    
    setActiveCitation(demoCitation);
  }, [setActiveCitation]);

  // Fetch PDF
  const { blobUrl, loading, error } = usePdfFetch(activeCitation?.filename || null);

  // Update live region when citation changes
  useEffect(() => {
    if (activeCitation) {
      setLiveMessage(
        `Citation highlighted on page ${activeCitation.pageNumber}, ` +
        `offsets ${activeCitation.offsetStart}–${activeCitation.offsetEnd}`
      );
    } else {
      setLiveMessage('');
    }
  }, [activeCitation]);

  if (loading) {
    return (
      <div className="app-loading">
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <p>Error loading PDF: {error.message}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="app-empty">
        <p>No PDF loaded. Use window.setActiveCitation() to load a citation.</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Citation PDF Viewer</h1>
        {activeCitation && (
          <div className="citation-status">
            <span className="status-label">Active Citation:</span>
            <span className="status-value">
              Page {activeCitation.pageNumber} 
              ({activeCitation.offsetStart}–{activeCitation.offsetEnd})
            </span>
          </div>
        )}
      </header>

      <main className="app-main">
        <CitationViewer fileUrl={blobUrl} />
      </main>

      <LiveRegion message={liveMessage} />
    </div>
  );
}

/**
 * Main App component with citation context provider.
 */
export default function App() {
  return (
    <CitationProvider>
      <AppContent />
    </CitationProvider>
  );
}
