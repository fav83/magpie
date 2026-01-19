import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initStreamingHandler } from '../../src/service-worker/streamingHandler';
import { setupChromeMock, resetChromeMock, chromeMock } from '../mocks/chrome';
import { PORT_NAMES, STORAGE_KEYS } from '../../src/config';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

// Mock dependencies
vi.mock('../../src/service-worker/openrouterApi', () => ({
  streamSummary: vi.fn(),
}));

vi.mock('../../src/utils/promptStorage', () => ({
  getPromptById: vi.fn(),
}));

vi.mock('../../src/utils/modelsApi', () => ({
  getModelContextLength: vi.fn(),
}));

import { streamSummary } from '../../src/service-worker/openrouterApi';
import { getPromptById } from '../../src/utils/promptStorage';
import { getModelContextLength } from '../../src/utils/modelsApi';

setupChromeMock();

const mockStreamSummary = streamSummary as ReturnType<typeof vi.fn>;
const mockGetPromptById = getPromptById as ReturnType<typeof vi.fn>;
const mockGetModelContextLength = getModelContextLength as ReturnType<typeof vi.fn>;

const defaultPrompt = {
  id: 'prompt1',
  name: 'Default Summary',
  text: 'Summarize: {transcript}',
  model: 'openai/gpt-4o-mini',
  isDefault: true,
};

describe('streamingHandler', () => {
  let mockPort: {
    name: string;
    postMessage: ReturnType<typeof vi.fn>;
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
    onDisconnect: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  };
  let portMessageListener: (message: unknown) => void;
  let portDisconnectListener: () => void;
  let getTranscriptForTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetChromeMock();
    vi.clearAllMocks();

    mockPort = {
      name: PORT_NAMES.SUMMARY_STREAM,
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn((listener) => { portMessageListener = listener; }),
        removeListener: vi.fn(),
      },
      onDisconnect: {
        addListener: vi.fn((listener) => { portDisconnectListener = listener; }),
        removeListener: vi.fn(),
      },
    };

    getTranscriptForTab = vi.fn();

    // Default mock implementations
    mockGetPromptById.mockResolvedValue(defaultPrompt);
    mockGetModelContextLength.mockResolvedValue(128000);
    mockStreamSummary.mockImplementation(async ({ callbacks }) => {
      callbacks.onComplete('Summary content');
    });

    chromeMock.storage.local.get.mockResolvedValue({
      [STORAGE_KEYS.API_KEY]: 'test-api-key',
    });

    chromeMock.tabs.get.mockResolvedValue({
      id: 1,
      url: 'https://www.youtube.com/watch?v=test123',
      title: 'Test Video',
    });

    getTranscriptForTab.mockResolvedValue({
      type: 'TRANSCRIPT_SUCCESS',
      transcript: 'Test transcript',
      videoTitle: 'Test Video Title',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initStreamingHandler', () => {
    it('should register onConnect listener', () => {
      initStreamingHandler(getTranscriptForTab);
      expect(chromeMock.runtime.onConnect.addListener).toHaveBeenCalled();
    });

    it('should ignore ports with wrong name', () => {
      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];

      const wrongPort = { ...mockPort, name: 'wrong-port' };
      connectListener(wrongPort);

      expect(wrongPort.onMessage.addListener).not.toHaveBeenCalled();
    });

    it('should set up listeners for correct port name', () => {
      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];

      connectListener(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      expect(mockPort.onDisconnect.addListener).toHaveBeenCalled();
    });
  });

  describe('KEEPALIVE message', () => {
    it('should respond with KEEPALIVE_ACK', () => {
      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({ type: 'KEEPALIVE' });

      expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'KEEPALIVE_ACK' });
    });
  });

  describe('STREAM_SUMMARY message', () => {
    it('should send STREAM_ERROR when no API key', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      // Wait for async operations
      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STREAM_ERROR',
            error: 'NO_API_KEY',
          })
        );
      });
    });

    it('should send STREAM_ERROR when prompt not found', async () => {
      mockGetPromptById.mockResolvedValue(null);

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'nonexistent',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STREAM_ERROR',
            error: 'API_ERROR',
          })
        );
      });
    });

    it('should send STREAM_ERROR when tab not found', async () => {
      chromeMock.tabs.get.mockRejectedValue(new Error('Tab not found'));

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 999,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STREAM_ERROR',
            error: 'NOT_YOUTUBE_VIDEO',
          })
        );
      });
    });

    it('should send STREAM_ERROR when not on YouTube', async () => {
      chromeMock.tabs.get.mockResolvedValue({
        id: 1,
        url: 'https://google.com',
        title: 'Google',
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STREAM_ERROR',
            error: 'NOT_YOUTUBE_VIDEO',
          })
        );
      });
    });

    it('should proceed with transcript fetch even when tab URL has different video ID', async () => {
      // Video ID validation was removed from streamingHandler because:
      // 1. Transcript extraction already validates video IDs
      // 2. After SPA navigation, tab.url might briefly be stale
      // 3. Video ID validation causes issues when quickly switching videos
      chromeMock.tabs.get.mockResolvedValue({
        id: 1,
        url: 'https://www.youtube.com/watch?v=different123',
        title: 'Different Video',
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      // Should still attempt to get transcript (which handles video ID validation)
      await vi.waitFor(() => {
        expect(getTranscriptForTab).toHaveBeenCalledWith(1, 'test123');
      });
    });

    it('should send STREAM_ERROR when transcript fails', async () => {
      getTranscriptForTab.mockResolvedValue({
        type: 'TRANSCRIPT_ERROR',
        error: 'NO_CAPTIONS',
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STREAM_ERROR',
            error: 'NO_CAPTIONS',
          })
        );
      });
    });

    it('should send STREAM_ERROR when transcript too long', async () => {
      getTranscriptForTab.mockResolvedValue({
        type: 'TRANSCRIPT_SUCCESS',
        transcript: 'a'.repeat(100000), // Very long transcript
        videoTitle: 'Long Video',
      });
      mockGetModelContextLength.mockResolvedValue(1000); // Small context

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STREAM_ERROR',
            error: 'CONTEXT_TOO_LONG',
          })
        );
      });
    });

    it('should proceed when context length check fails', async () => {
      mockGetModelContextLength.mockRejectedValue(new Error('API unavailable'));

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockStreamSummary).toHaveBeenCalled();
      });
    });

    it('should start streaming on success', async () => {
      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockStreamSummary).toHaveBeenCalledWith(
          expect.objectContaining({
            transcript: 'Test transcript',
            apiKey: 'test-api-key',
            prompt: 'Summarize: {transcript}',
            model: 'openai/gpt-4o-mini',
            callbacks: expect.objectContaining({
              onChunk: expect.any(Function),
              onComplete: expect.any(Function),
              onError: expect.any(Function),
            }),
            signal: expect.any(AbortSignal),
          })
        );
      });
    });

    it('should send STREAM_CHUNK on chunk callback', async () => {
      mockStreamSummary.mockImplementation(async ({ callbacks }) => {
        callbacks.onChunk('chunk content');
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith({
          type: 'STREAM_CHUNK',
          content: 'chunk content',
          videoId: 'test123',
          promptId: 'prompt1',
        });
      });
    });

    it('should send STREAM_COMPLETE on complete callback', async () => {
      mockStreamSummary.mockImplementation(async ({ callbacks }) => {
        callbacks.onComplete('full content');
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith({
          type: 'STREAM_COMPLETE',
          videoId: 'test123',
          videoTitle: 'Test Video Title',
          promptId: 'prompt1',
          modelId: 'openai/gpt-4o-mini',
          fullContent: 'full content',
        });
      });
    });

    it('should send STREAM_ERROR on error callback', async () => {
      mockStreamSummary.mockImplementation(async ({ callbacks }) => {
        callbacks.onError('RATE_LIMITED', 'partial content');
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(mockPort.postMessage).toHaveBeenCalledWith({
          type: 'STREAM_ERROR',
          error: 'RATE_LIMITED',
          partialContent: 'partial content',
          videoId: 'test123',
          promptId: 'prompt1',
        });
      });
    });
  });

  describe('CANCEL_STREAM message', () => {
    it('should abort active stream', async () => {
      let abortSignal: AbortSignal | null = null;
      mockStreamSummary.mockImplementation(async ({ signal }) => {
        abortSignal = signal;
        // Simulate long-running stream
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      // Start streaming
      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(abortSignal).not.toBe(null);
      });

      // Cancel stream
      portMessageListener({ type: 'CANCEL_STREAM' });

      expect(abortSignal!.aborted).toBe(true);
    });
  });

  describe('port disconnect', () => {
    it('should abort active stream on disconnect', async () => {
      let abortSignal: AbortSignal | null = null;
      mockStreamSummary.mockImplementation(async ({ signal }) => {
        abortSignal = signal;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      initStreamingHandler(getTranscriptForTab);
      const connectListener = chromeMock.runtime.onConnect.addListener.mock.calls[0]![0];
      connectListener(mockPort);

      // Start streaming
      portMessageListener({
        type: 'STREAM_SUMMARY',
        videoId: 'test123',
        promptId: 'prompt1',
        modelId: 'openai/gpt-4o-mini',
        tabId: 1,
      });

      await vi.waitFor(() => {
        expect(abortSignal).not.toBe(null);
      });

      // Disconnect port
      portDisconnectListener();

      expect(abortSignal!.aborted).toBe(true);
    });
  });
});
