import { useState, useRef, useCallback } from 'react';

interface UseBufferedMarkdownReturn {
  /** The content ready to be displayed (complete lines only) */
  displayContent: string;
  /** Add new content from a streaming chunk */
  appendChunk: (chunk: string) => void;
  /** Flush any remaining buffer (call on stream complete) */
  flush: () => void;
  /** Reset all state */
  reset: () => void;
  /** Get the full accumulated content (including buffer) */
  getFullContent: () => string;
}

/**
 * Hook for buffering streaming markdown content.
 * Only updates displayContent on newline boundaries for stable rendering.
 */
export function useBufferedMarkdown(): UseBufferedMarkdownReturn {
  const [displayContent, setDisplayContent] = useState('');
  const bufferRef = useRef('');
  const fullContentRef = useRef('');

  const appendChunk = useCallback((chunk: string) => {
    // Add to full content
    fullContentRef.current += chunk;

    // Add to buffer
    bufferRef.current += chunk;

    // Check for newlines
    const lastNewlineIndex = bufferRef.current.lastIndexOf('\n');
    if (lastNewlineIndex !== -1) {
      // Extract content up to and including the last newline
      const contentToRender = bufferRef.current.slice(0, lastNewlineIndex + 1);
      // Keep the rest in the buffer
      bufferRef.current = bufferRef.current.slice(lastNewlineIndex + 1);

      // Update display content
      setDisplayContent((prev) => prev + contentToRender);
    }
  }, []);

  const flush = useCallback(() => {
    // Flush any remaining buffer content
    const buffered = bufferRef.current;
    if (buffered) {
      bufferRef.current = '';
      setDisplayContent((prev) => prev + buffered);
    }
  }, []);

  const reset = useCallback(() => {
    setDisplayContent('');
    bufferRef.current = '';
    fullContentRef.current = '';
  }, []);

  const getFullContent = useCallback(() => {
    return fullContentRef.current;
  }, []);

  return {
    displayContent,
    appendChunk,
    flush,
    reset,
    getFullContent,
  };
}
