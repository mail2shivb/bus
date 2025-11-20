import { useState, useEffect } from 'react';

/**
 * Hook for fetching PDF files from the backend.
 * 
 * @param filename - The name of the PDF file to fetch
 * @returns Object containing blob URL, loading state, and error
 */
export function usePdfFetch(filename: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!filename) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    const currentBlobUrl = blobUrl;

    const fetchPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/pdf?filename=${encodeURIComponent(filename)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        const blob = await response.blob();
        
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        } else {
          // Clean up if component unmounted during fetch
          URL.revokeObjectURL(URL.createObjectURL(blob));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      cancelled = true;
      // Clean up the previous blob URL
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [filename]); // eslint-disable-line react-hooks/exhaustive-deps

  return { blobUrl, loading, error };
}
