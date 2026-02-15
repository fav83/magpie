// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '../../src/hooks/useCopyToClipboard';

const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
});

beforeEach(() => {
  vi.useFakeTimers();
  mockWriteText.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCopyToClipboard', () => {
  describe('initial state', () => {
    it('starts with copied = false', () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(result.current.copied).toBe(false);
    });
  });

  describe('copy', () => {
    it('writes text to clipboard', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('hello world');
      });

      expect(mockWriteText).toHaveBeenCalledWith('hello world');
    });

    it('sets copied to true immediately after copy', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('text');
      });

      expect(result.current.copied).toBe(true);
    });

    it('resets copied to false after 1500ms', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('text');
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.copied).toBe(false);
    });

    it('stays true before 1500ms elapses', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('text');
      });

      act(() => {
        vi.advanceTimersByTime(1499);
      });

      expect(result.current.copied).toBe(true);
    });
  });

  describe('showCopied', () => {
    it('sets copied to true without writing to clipboard', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.showCopied();
      });

      expect(result.current.copied).toBe(true);
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    it('resets copied to false after 1500ms', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.showCopied();
      });

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.copied).toBe(false);
    });

    it('resets the timer when called again before expiry', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.showCopied();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Still true, call again to reset timer
      act(() => {
        result.current.showCopied();
      });

      // Advance another 1000ms (total 2000ms from first call, but only 1000ms from second)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.copied).toBe(true);

      // Now advance the remaining 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.copied).toBe(false);
    });
  });

  describe('reset', () => {
    it('sets copied to false immediately', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('text');
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.copied).toBe(false);
    });

    it('cancels the pending timer', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('text');
      });

      act(() => {
        result.current.reset();
      });

      // Advance past the timeout -- should stay false because timer was cancelled
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copied).toBe(false);
    });
  });

  describe('cleanup on unmount', () => {
    it('clears the timer when the hook unmounts', () => {
      const { result, unmount } = renderHook(() => useCopyToClipboard());

      act(() => {
        result.current.copy('text');
      });

      unmount();

      // Should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    });
  });
});
