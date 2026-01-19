import { useState, useEffect, useRef, useCallback } from 'react';

interface UseDropdownStateOptions {
  onClose?: () => void;
}

interface UseDropdownStateReturn {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
}

/**
 * Hook for managing dropdown state with click outside handling and input focus
 */
export function useDropdownState(options?: UseDropdownStateOptions): UseDropdownStateReturn {
  const [isOpen, setIsOpenInternal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Wrap setIsOpen to call onClose callback when closing
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenInternal(open);
    if (!open) {
      options?.onClose?.();
    }
  }, [options]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setIsOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return {
    isOpen,
    setIsOpen,
    containerRef,
    inputRef,
  };
}
