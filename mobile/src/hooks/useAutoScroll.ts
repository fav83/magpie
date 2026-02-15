import { useEffect, useRef } from 'react';

/**
 * Auto-scrolls a container to the bottom when streaming content updates,
 * unless the user has manually scrolled up.
 */
export function useAutoScroll(deps: {
  summaryStreaming: boolean;
  summaryContent: string;
  chatStreaming: boolean;
  chatContent: string;
  state: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  // Track manual scroll-up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      userScrolledUpRef.current = distanceFromBottom > 50;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll on new streaming content (summary or chat)
  useEffect(() => {
    const isSummaryStreaming = deps.summaryStreaming && deps.summaryContent;
    const isChatStreaming = deps.chatStreaming && deps.chatContent;
    if ((isSummaryStreaming || isChatStreaming) && !userScrolledUpRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [deps.summaryContent, deps.summaryStreaming, deps.chatStreaming, deps.chatContent]);

  // Reset scroll tracking on new summarization
  useEffect(() => {
    if (deps.state === 'fetching-transcript') {
      userScrolledUpRef.current = false;
    }
  }, [deps.state]);

  return scrollContainerRef;
}
