import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom';
}

export function Tooltip({
  content,
  children,
  delay = 100,
  position = 'top',
}: TooltipProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const updatePosition = useCallback(() => {
    if (!containerRef.current || !tooltipRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const padding = 4; // Minimum distance from edge

    // Calculate centered position
    let left = (containerRect.width - tooltipRect.width) / 2;

    // Check if tooltip would overflow on the left
    const tooltipLeft = containerRect.left + left;
    if (tooltipLeft < padding) {
      left = padding - containerRect.left;
    }

    // Check if tooltip would overflow on the right
    const tooltipRight = containerRect.left + left + tooltipRect.width;
    if (tooltipRight > viewportWidth - padding) {
      left = viewportWidth - padding - tooltipRect.width - containerRect.left;
    }

    setTooltipStyle({ left: `${left}px` });
  }, []);

  useLayoutEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = position === 'top'
    ? 'bottom-full mb-1'
    : 'top-full mt-1';

  const handleFocus = () => {
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={tooltipStyle}
          className={`absolute ${positionClasses} z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap pointer-events-none`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
