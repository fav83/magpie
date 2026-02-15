import { useState, useRef, useCallback, useEffect } from 'react';

const COPY_SUCCESS_DURATION_MS = 1500;

interface UseCopyToClipboardReturn {
  copied: boolean;
  /** Write text to clipboard and show success state */
  copy: (text: string) => void;
  /** Show success state without writing to clipboard (for when parent handles the write) */
  showCopied: () => void;
  reset: () => void;
}

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const reset = useCallback(() => {
    setCopied(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showCopied = useCallback(() => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, COPY_SUCCESS_DURATION_MS);
  }, []);

  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    showCopied();
  }, [showCopied]);

  return { copied, copy, showCopied, reset };
}
