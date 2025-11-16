import { useEffect, useRef } from 'react';

interface LiveRegionProps {
  message: string;
}

/**
 * Accessible live region component for screen reader announcements.
 * Announces citation highlights when they are applied.
 */
export function LiveRegion({ message }: LiveRegionProps) {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveRegionRef.current && message) {
      // Clear and re-set to ensure announcement
      liveRegionRef.current.textContent = '';
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message;
        }
      }, 100);
    }
  }, [message]);

  return (
    <div
      ref={liveRegionRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    />
  );
}
