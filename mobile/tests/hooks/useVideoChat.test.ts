// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoChat } from '../../src/hooks/useVideoChat';

// Mock streamChat
const mockStreamChat = vi.fn();
vi.mock('../../src/services/streamingChat', () => ({
  streamChat: (...args: unknown[]) => mockStreamChat(...args),
}));

beforeEach(() => {
  mockStreamChat.mockReset();
});

const baseParams = {
  apiKey: 'sk-test-key',
  model: 'openai/gpt-4o-mini',
  summary: 'Test summary',
  transcript: 'Test transcript',
};

describe('useVideoChat', () => {
  describe('initial state', () => {
    it('should start with empty messages', () => {
      const { result } = renderHook(() => useVideoChat(baseParams));
      expect(result.current.messages).toEqual([]);
    });

    it('should start collapsed', () => {
      const { result } = renderHook(() => useVideoChat(baseParams));
      expect(result.current.isExpanded).toBe(false);
    });

    it('should not be streaming', () => {
      const { result } = renderHook(() => useVideoChat(baseParams));
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should add user and assistant messages', () => {
      mockStreamChat.mockResolvedValue(undefined);
      const { result } = renderHook(() => useVideoChat(baseParams));

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]?.role).toBe('user');
      expect(result.current.messages[0]?.content).toBe('Hello');
      expect(result.current.messages[0]?.status).toBe('complete');
      expect(result.current.messages[1]?.role).toBe('assistant');
      expect(result.current.messages[1]?.status).toBe('streaming');
    });

    it('should expand the chat section', () => {
      mockStreamChat.mockResolvedValue(undefined);
      const { result } = renderHook(() => useVideoChat(baseParams));

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.isExpanded).toBe(true);
    });

    it('should set isStreaming to true', () => {
      mockStreamChat.mockResolvedValue(undefined);
      const { result } = renderHook(() => useVideoChat(baseParams));

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.isStreaming).toBe(true);
    });

    it('should not send empty messages', () => {
      const { result } = renderHook(() => useVideoChat(baseParams));

      act(() => {
        result.current.sendMessage('   ');
      });

      expect(result.current.messages).toHaveLength(0);
      expect(mockStreamChat).not.toHaveBeenCalled();
    });

    it('should not send when no API key', () => {
      const { result } = renderHook(() =>
        useVideoChat({ ...baseParams, apiKey: null })
      );

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(0);
      expect(mockStreamChat).not.toHaveBeenCalled();
    });

    it('should trim whitespace from message', () => {
      mockStreamChat.mockResolvedValue(undefined);
      const { result } = renderHook(() => useVideoChat(baseParams));

      act(() => {
        result.current.sendMessage('  Hello World  ');
      });

      expect(result.current.messages[0]?.content).toBe('Hello World');
    });

    it('should pass summary and transcript to streamChat', () => {
      mockStreamChat.mockResolvedValue(undefined);
      const { result } = renderHook(() => useVideoChat(baseParams));

      act(() => {
        result.current.sendMessage('Hello');
      });

      expect(mockStreamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'Test summary',
          transcript: 'Test transcript',
          model: 'openai/gpt-4o-mini',
          apiKey: 'sk-test-key',
          userMessage: 'Hello',
        })
      );
    });

    it('should update assistant message on complete', async () => {
      mockStreamChat.mockImplementation(async (options: { callbacks: { onComplete: (content: string) => void } }) => {
        options.callbacks.onComplete('Response text');
      });

      const { result } = renderHook(() => useVideoChat(baseParams));

      await act(async () => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages[1]?.content).toBe('Response text');
      expect(result.current.messages[1]?.status).toBe('complete');
      expect(result.current.isStreaming).toBe(false);
    });

    it('should update assistant message on error', async () => {
      mockStreamChat.mockImplementation(async (options: { callbacks: { onError: (error: string, partial: string | null, details?: string) => void } }) => {
        options.callbacks.onError('API_ERROR', 'partial content', 'Some error');
      });

      const { result } = renderHook(() => useVideoChat(baseParams));

      await act(async () => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages[1]?.status).toBe('error');
      expect(result.current.messages[1]?.content).toBe('partial content');
      expect(result.current.messages[1]?.error).toContain('Some error');
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('toggleExpanded', () => {
    it('should toggle the expanded state', () => {
      const { result } = renderHook(() => useVideoChat(baseParams));

      expect(result.current.isExpanded).toBe(false);

      act(() => {
        result.current.toggleExpanded();
      });

      expect(result.current.isExpanded).toBe(true);

      act(() => {
        result.current.toggleExpanded();
      });

      expect(result.current.isExpanded).toBe(false);
    });
  });

  describe('clearChat', () => {
    it('should clear all messages', async () => {
      mockStreamChat.mockImplementation(async (options: { callbacks: { onComplete: (content: string) => void } }) => {
        options.callbacks.onComplete('Response');
      });

      const { result } = renderHook(() => useVideoChat(baseParams));

      await act(async () => {
        result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.clearChat();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      mockStreamChat.mockImplementation(async (options: { callbacks: { onComplete: (content: string) => void } }) => {
        options.callbacks.onComplete('Response');
      });

      const { result } = renderHook(() => useVideoChat(baseParams));

      await act(async () => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.isExpanded).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('history building', () => {
    it('should pass complete messages as history for second message', async () => {
      mockStreamChat.mockImplementation(async (options: { callbacks: { onComplete: (content: string) => void } }) => {
        options.callbacks.onComplete('First response');
      });

      const { result } = renderHook(() => useVideoChat(baseParams));

      // Send first message
      await act(async () => {
        result.current.sendMessage('First question');
      });

      // Reset mock to capture second call
      mockStreamChat.mockImplementation(async (options: { callbacks: { onComplete: (content: string) => void } }) => {
        options.callbacks.onComplete('Second response');
      });

      // Send second message
      await act(async () => {
        result.current.sendMessage('Second question');
      });

      const secondCall = mockStreamChat.mock.calls[1] as [{ history: { role: string; content: string }[] }];
      const history = secondCall[0].history;
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'First question' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'First response' });
    });
  });
});
