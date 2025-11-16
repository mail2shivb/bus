import { Rect } from '../lib/types';

interface HighlightLayerProps {
  rects: Rect[];
  pageNumber: number;
  offsetStart: number;
  offsetEnd: number;
}

/**
 * Component for rendering highlight overlays on PDF pages.
 * Renders absolutely positioned divs for each highlight rectangle.
 */
export function HighlightLayer({ rects, pageNumber, offsetStart, offsetEnd }: HighlightLayerProps) {
  if (rects.length === 0) {
    return null;
  }

  const ariaLabel = `Citation highlight on page ${pageNumber}, offsets ${offsetStart}–${offsetEnd}`;

  return (
    <div className="highlight-layer">
      {rects.map((rect, index) => (
        <div
          key={index}
          className="highlight-rect"
          role="note"
          aria-label={ariaLabel}
          tabIndex={index === 0 ? 0 : -1}
          style={{
            position: 'absolute',
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'rgba(255, 255, 0, 0.3)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      ))}
    </div>
  );
}
