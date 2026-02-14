// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBufferedMarkdown } from '../../src/hooks/useBufferedMarkdown';

describe('useBufferedMarkdown', () => {
  describe('initial state', () => {
    it('should start with empty displayContent', () => {
      const { result } = renderHook(() => useBufferedMarkdown());
      expect(result.current.displayContent).toBe('');
    });

    it('should return empty string from getFullContent initially', () => {
      const { result } = renderHook(() => useBufferedMarkdown());
      expect(result.current.getFullContent()).toBe('');
    });
  });

  describe('appendChunk', () => {
    it('should not update displayContent until newline is received', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('partial content');
      });

      expect(result.current.displayContent).toBe('');
      expect(result.current.getFullContent()).toBe('partial content');
    });

    it('should update displayContent when newline is received', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('line one\n');
      });

      expect(result.current.displayContent).toBe('line one\n');
    });

    it('should accumulate multiple complete lines', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('line one\n');
        result.current.appendChunk('line two\n');
      });

      expect(result.current.displayContent).toBe('line one\nline two\n');
    });

    it('should buffer partial lines until newline', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('line one\npartial');
      });

      // Only complete line shown
      expect(result.current.displayContent).toBe('line one\n');
      // Full content includes partial
      expect(result.current.getFullContent()).toBe('line one\npartial');
    });

    it('should handle chunks with multiple newlines', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('line one\nline two\nline three\n');
      });

      expect(result.current.displayContent).toBe('line one\nline two\nline three\n');
    });

    it('should handle partial lines split across chunks', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('Hello ');
      });
      expect(result.current.displayContent).toBe('');

      act(() => {
        result.current.appendChunk('World');
      });
      expect(result.current.displayContent).toBe('');

      act(() => {
        result.current.appendChunk('\n');
      });
      expect(result.current.displayContent).toBe('Hello World\n');
    });

    it('should handle trailing content after newline in chunk', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('first line\nsecond');
      });

      expect(result.current.displayContent).toBe('first line\n');

      act(() => {
        result.current.appendChunk(' line\n');
      });

      expect(result.current.displayContent).toBe('first line\nsecond line\n');
    });
  });

  describe('flush', () => {
    it('should flush remaining buffer content', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('complete line\npartial content');
        result.current.flush();
      });

      expect(result.current.displayContent).toBe('complete line\npartial content');
    });

    it('should flush buffered content separately from displayed content', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('complete line\npartial content');
      });

      expect(result.current.displayContent).toBe('complete line\n');
      expect(result.current.getFullContent()).toBe('complete line\npartial content');

      act(() => {
        result.current.flush();
      });

      expect(result.current.displayContent).toBe('complete line\npartial content');
    });

    it('should do nothing when buffer is empty', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('complete line\n');
      });

      const contentBefore = result.current.displayContent;

      act(() => {
        result.current.flush();
      });

      expect(result.current.displayContent).toBe(contentBefore);
    });

    it('should clear the buffer after flushing', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('partial');
        result.current.flush();
      });

      expect(result.current.displayContent).toBe('partial');

      act(() => {
        result.current.flush();
      });

      expect(result.current.displayContent).toBe('partial');
    });
  });

  describe('reset', () => {
    it('should reset displayContent to empty string', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('some content\n');
      });

      expect(result.current.displayContent).toBe('some content\n');

      act(() => {
        result.current.reset();
      });

      expect(result.current.displayContent).toBe('');
    });

    it('should reset fullContent to empty string', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('some content');
      });

      expect(result.current.getFullContent()).toBe('some content');

      act(() => {
        result.current.reset();
      });

      expect(result.current.getFullContent()).toBe('');
    });

    it('should clear the buffer', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('buffered');
        result.current.reset();
      });

      act(() => {
        result.current.flush();
      });

      expect(result.current.displayContent).toBe('');
    });
  });

  describe('getFullContent', () => {
    it('should return all accumulated content including buffer', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('displayed\nstill buffered');
      });

      expect(result.current.getFullContent()).toBe('displayed\nstill buffered');
      expect(result.current.displayContent).toBe('displayed\n');
    });

    it('should track all chunks regardless of newlines', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('a');
        result.current.appendChunk('b');
        result.current.appendChunk('c\n');
        result.current.appendChunk('d');
      });

      expect(result.current.getFullContent()).toBe('abc\nd');
    });
  });

  describe('edge cases', () => {
    it('should handle empty chunks', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('');
        result.current.appendChunk('');
      });

      expect(result.current.displayContent).toBe('');
      expect(result.current.getFullContent()).toBe('');
    });

    it('should handle newline-only chunks', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('\n');
      });

      expect(result.current.displayContent).toBe('\n');
    });

    it('should handle multiple consecutive newlines', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      act(() => {
        result.current.appendChunk('line\n\n\n');
      });

      expect(result.current.displayContent).toBe('line\n\n\n');
    });

    it('should handle markdown code blocks', () => {
      const { result } = renderHook(() => useBufferedMarkdown());

      const markdown = '```javascript\nconst x = 1;\n```\n';

      act(() => {
        result.current.appendChunk(markdown);
      });

      expect(result.current.displayContent).toBe(markdown);
    });
  });
});
