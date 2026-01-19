import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDropdownState } from '../../src/hooks/useDropdownState';

describe('useDropdownState', () => {
  describe('initial state', () => {
    it('should start with isOpen=false', () => {
      const { result } = renderHook(() => useDropdownState());
      expect(result.current.isOpen).toBe(false);
    });

    it('should provide refs', () => {
      const { result } = renderHook(() => useDropdownState());
      expect(result.current.containerRef).toBeDefined();
      expect(result.current.inputRef).toBeDefined();
    });
  });

  describe('setIsOpen', () => {
    it('should toggle isOpen state', () => {
      const { result } = renderHook(() => useDropdownState());

      act(() => {
        result.current.setIsOpen(true);
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setIsOpen(false);
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('click outside handling', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should add mousedown event listener on mount', () => {
      renderHook(() => useDropdownState());
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('should remove mousedown event listener on unmount', () => {
      const { unmount } = renderHook(() => useDropdownState());
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });
  });

  describe('input focus behavior', () => {
    it('should focus input when opened', () => {
      const focusMock = vi.fn();
      const { result } = renderHook(() => useDropdownState());

      // Mock the input ref
      Object.defineProperty(result.current.inputRef, 'current', {
        value: { focus: focusMock },
        writable: true,
      });

      act(() => {
        result.current.setIsOpen(true);
      });

      expect(focusMock).toHaveBeenCalled();
    });
  });

  describe('onClose callback', () => {
    it('should call onClose callback when closing', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() => useDropdownState({ onClose }));

      act(() => {
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.setIsOpen(false);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when opening', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() => useDropdownState({ onClose }));

      act(() => {
        result.current.setIsOpen(true);
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose every time dropdown is closed', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() => useDropdownState({ onClose }));

      act(() => {
        result.current.setIsOpen(true);
        result.current.setIsOpen(false);
        result.current.setIsOpen(true);
        result.current.setIsOpen(false);
      });

      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('should work without onClose callback', () => {
      const { result } = renderHook(() => useDropdownState());

      act(() => {
        result.current.setIsOpen(true);
        result.current.setIsOpen(false);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });
});
