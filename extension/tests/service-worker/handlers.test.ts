import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYSTEM_PROMPT_ID } from '../../src/types/prompt';

// We need to test the handlers by importing the module after mocking
// First, set up all mocks before importing

const mockSummarizeTranscript = vi.fn();
const mockGetModelContextLength = vi.fn();

vi.mock('../../src/service-worker/openrouterApi', () => ({
  summarizeTranscript: mockSummarizeTranscript,
}));

vi.mock('../../src/utils/modelsApi', () => ({
  getModelContextLength: () => mockGetModelContextLength(),
}));

// Mock chrome APIs more thoroughly
const mockChrome = {
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn(),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    onConnect: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    get: vi.fn(),
    query: vi.fn(),
    sendMessage: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('Service Worker Handlers', () => {
  let messageHandler: (
    message: unknown,
    sender: unknown,
    sendResponse: (response: unknown) => void
  ) => boolean;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    // Restore default mock implementations after resetAllMocks
    // These must be set BEFORE importing modules that use them at load time
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue(undefined);

    // Set up default mock for model context length (128K tokens)
    mockGetModelContextLength.mockResolvedValue(128000);

    // Re-import to get fresh module with mocks
    await import('../../src/service-worker/index');

    // Capture the message handler that was registered
    const onMessageCalls = mockChrome.runtime.onMessage.addListener.mock.calls;
    if (onMessageCalls.length > 0 && onMessageCalls[0]) {
      messageHandler = onMessageCalls[0][0] as typeof messageHandler;
    }
  });

  describe('GET_SUMMARY handler', () => {
    it('should return NO_API_KEY error when no API key is set', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({ type: 'SUMMARY_ERROR', error: 'NO_API_KEY' });
    });

    it('should return NOT_YOUTUBE_VIDEO error when not on YouTube', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://google.com' },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'SUMMARY_ERROR',
        error: 'NOT_YOUTUBE_VIDEO',
      });
    });

    it('should return NOT_YOUTUBE_VIDEO when on YouTube but not a video page', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/' },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'SUMMARY_ERROR',
        error: 'NOT_YOUTUBE_VIDEO',
      });
    });

    it('should return transcript error when content script fails', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.tabs.sendMessage.mockResolvedValue({
        type: 'TRANSCRIPT_ERROR',
        error: 'NO_CAPTIONS',
      });

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({ type: 'SUMMARY_ERROR', error: 'NO_CAPTIONS' });
    });

    it('should return CONTEXT_TOO_LONG when transcript exceeds model limit', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      // Create a transcript that would exceed context limit
      // Model has 1000 tokens, so 4000 chars = 1000 tokens, exceeds 90% threshold
      const longTranscript = 'x'.repeat(4000);
      mockChrome.tabs.sendMessage.mockResolvedValue({
        type: 'TRANSCRIPT_SUCCESS',
        transcript: longTranscript,
        videoTitle: 'Test Video',
      });
      // Model context is only 1000 tokens
      mockGetModelContextLength.mockResolvedValue(1000);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'SUMMARY_ERROR',
        error: 'CONTEXT_TOO_LONG',
      });
      // Should not call the API
      expect(mockSummarizeTranscript).not.toHaveBeenCalled();
    });

    it('should return summary on success', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.tabs.sendMessage.mockResolvedValue({
        type: 'TRANSCRIPT_SUCCESS',
        transcript: 'Hello world transcript',
        videoTitle: 'Test Video',
      });
      mockSummarizeTranscript.mockResolvedValue({
        success: true,
        data: 'This is a summary',
      });

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'SUMMARY_SUCCESS',
        summary: 'This is a summary',
        videoTitle: 'Test Video',
        promptId: SYSTEM_PROMPT_ID,
        modelId: 'openai/gpt-4o-mini',
      });
      expect(mockSummarizeTranscript).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: 'Hello world transcript',
          apiKey: 'sk-or-test',
          prompt: expect.stringContaining('{transcript}'),
          model: 'openai/gpt-4o-mini',
        })
      );
    });

    it('should return API error when summarization fails', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.tabs.sendMessage.mockResolvedValue({
        type: 'TRANSCRIPT_SUCCESS',
        transcript: 'Hello world transcript',
        videoTitle: 'Test Video',
      });
      mockSummarizeTranscript.mockResolvedValue({
        success: false,
        error: 'RATE_LIMITED',
      });

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_SUMMARY' }, {}, resolve);
      });

      expect(response).toEqual({ type: 'SUMMARY_ERROR', error: 'RATE_LIMITED' });
    });
  });

  describe('GET_API_KEY handler', () => {
    it('should return hasKey: false when no key is set', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_API_KEY' }, {}, resolve);
      });

      expect(response).toEqual({ type: 'API_KEY_SUCCESS', hasKey: false });
    });

    it('should return hasKey: true when key is set', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        openrouterApiKey: 'sk-or-test',
      });

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_API_KEY' }, {}, resolve);
      });

      expect(response).toEqual({ type: 'API_KEY_SUCCESS', hasKey: true });
    });

    it('should return error when storage fails', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_API_KEY' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'API_KEY_ERROR',
        error: 'Failed to get API key',
      });
    });
  });

  describe('SAVE_API_KEY handler', () => {
    it('should save API key successfully', async () => {
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      const response = await new Promise((resolve) => {
        messageHandler(
          { type: 'SAVE_API_KEY', apiKey: 'sk-or-new-key' },
          {},
          resolve
        );
      });

      expect(response).toEqual({ type: 'SAVE_API_KEY_SUCCESS' });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        openrouterApiKey: 'sk-or-new-key',
      });
    });

    it('should return error when save fails', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      const response = await new Promise((resolve) => {
        messageHandler(
          { type: 'SAVE_API_KEY', apiKey: 'sk-or-new-key' },
          {},
          resolve
        );
      });

      expect(response).toEqual({
        type: 'SAVE_API_KEY_ERROR',
        error: 'Failed to save API key',
      });
    });
  });

  describe('GET_TRANSCRIPT handler', () => {
    it('should return error (transcripts handled by content script)', async () => {
      const response = await new Promise((resolve) => {
        messageHandler(
          { type: 'GET_TRANSCRIPT', videoId: 'abc123' },
          {},
          resolve
        );
      });

      expect(response).toEqual({
        type: 'TRANSCRIPT_ERROR',
        error: 'EXTRACTION_FAILED',
      });
    });
  });

  describe('Icon click handler', () => {
    it('should register click handler on load', async () => {
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
    });

    it('should open side panel when icon is clicked', async () => {
      const calls = mockChrome.action.onClicked.addListener.mock.calls;
      const clickHandler = calls[0]?.[0] as
        | ((tab: { id?: number }) => void)
        | undefined;

      clickHandler?.({ id: 123 });

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 123 });
    });

    it('should not open side panel when tab has no id', async () => {
      const calls = mockChrome.action.onClicked.addListener.mock.calls;
      const clickHandler = calls[0]?.[0] as
        | ((tab: { id?: number }) => void)
        | undefined;

      clickHandler?.({});

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled();
    });
  });

  describe('Context menu handler', () => {
    it('should register context menu on install', async () => {
      const calls = mockChrome.runtime.onInstalled.addListener.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // Trigger the onInstalled handler
      const installHandler = calls[0]?.[0] as (() => void) | undefined;
      installHandler?.();

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'summarize-video',
        title: 'Summarize this video',
        contexts: ['page'],
        documentUrlPatterns: ['*://www.youtube.com/watch*'],
      });
    });

    it('should register context menu click handler', async () => {
      expect(mockChrome.contextMenus.onClicked.addListener).toHaveBeenCalled();
    });

    it('should open side panel when context menu is clicked', async () => {
      const calls = mockChrome.contextMenus.onClicked.addListener.mock.calls;
      const clickHandler = calls[0]?.[0] as
        | ((info: { menuItemId: string }, tab?: { id?: number }) => void)
        | undefined;

      clickHandler?.({ menuItemId: 'summarize-video' }, { id: 123 });

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 123 });
    });

    it('should not open side panel for different menu item', async () => {
      const calls = mockChrome.contextMenus.onClicked.addListener.mock.calls;
      const clickHandler = calls[0]?.[0] as
        | ((info: { menuItemId: string }, tab?: { id?: number }) => void)
        | undefined;

      mockChrome.sidePanel.open.mockClear();
      clickHandler?.({ menuItemId: 'other-menu-item' }, { id: 123 });

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled();
    });

    it('should not open side panel when tab has no id', async () => {
      const calls = mockChrome.contextMenus.onClicked.addListener.mock.calls;
      const clickHandler = calls[0]?.[0] as
        | ((info: { menuItemId: string }, tab?: { id?: number }) => void)
        | undefined;

      mockChrome.sidePanel.open.mockClear();
      clickHandler?.({ menuItemId: 'summarize-video' }, {});

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled();
    });
  });

  describe('GET_VIDEO_INFO handler', () => {
    it('should return error when not on YouTube video page', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://google.com' },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'Not on YouTube video page',
      });
    });

    it('should return error when on YouTube but not video page', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/feed/subscriptions' },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'Not on YouTube video page',
      });
    });

    it('should return error when tab has no id', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { url: 'https://www.youtube.com/watch?v=abc123' },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'Tab ID is undefined',
      });
    });

    it('should return video info on success', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.scripting.executeScript.mockResolvedValue([
        {
          result: {
            type: 'VIDEO_INFO_SUCCESS',
            videoId: 'abc123',
            videoTitle: 'Test Video Title',
            videoUrl: 'https://www.youtube.com/watch?v=abc123',
          },
        },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'abc123',
        videoTitle: 'Test Video Title',
        videoUrl: 'https://www.youtube.com/watch?v=abc123',
      });
    });

    it('should return error when script execution fails', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.scripting.executeScript.mockRejectedValue(
        new Error('Script execution failed')
      );

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'Error: Script execution failed',
      });
    });

    it('should return error when no result from page context', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.scripting.executeScript.mockResolvedValue([
        { result: null },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'No result from page context',
      });
    });

    it('should use explicit tabId when provided', async () => {
      mockChrome.tabs.get.mockResolvedValue({
        id: 5,
        url: 'https://www.youtube.com/watch?v=xyz789',
      });
      mockChrome.scripting.executeScript.mockResolvedValue([
        {
          result: {
            type: 'VIDEO_INFO_SUCCESS',
            videoId: 'xyz789',
            videoTitle: 'Explicit Tab Video',
            videoUrl: 'https://www.youtube.com/watch?v=xyz789',
          },
        },
      ]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO', tabId: 5 }, {}, resolve);
      });

      expect(mockChrome.tabs.get).toHaveBeenCalledWith(5);
      expect(mockChrome.tabs.query).not.toHaveBeenCalled();
      expect(response).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'xyz789',
        videoTitle: 'Explicit Tab Video',
        videoUrl: 'https://www.youtube.com/watch?v=xyz789',
      });
    });

    it('should use sender tab when available', async () => {
      mockChrome.scripting.executeScript.mockResolvedValue([
        {
          result: {
            type: 'VIDEO_INFO_SUCCESS',
            videoId: 'sender123',
            videoTitle: 'Sender Tab Video',
            videoUrl: 'https://www.youtube.com/watch?v=sender123',
          },
        },
      ]);

      const sender = {
        tab: {
          id: 10,
          url: 'https://www.youtube.com/watch?v=sender123',
        },
      };

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, sender, resolve);
      });

      expect(mockChrome.tabs.get).not.toHaveBeenCalled();
      expect(mockChrome.tabs.query).not.toHaveBeenCalled();
      expect(response).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'sender123',
        videoTitle: 'Sender Tab Video',
        videoUrl: 'https://www.youtube.com/watch?v=sender123',
      });
    });
  });

  describe('resolveTab behavior', () => {
    it('should fall back to active tab query when tabId not provided and no sender.tab', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://www.youtube.com/watch?v=abc123' },
      ]);
      mockChrome.scripting.executeScript.mockResolvedValue([
        {
          result: {
            type: 'VIDEO_INFO_SUCCESS',
            videoId: 'abc123',
            videoTitle: 'Active Tab Video',
            videoUrl: 'https://www.youtube.com/watch?v=abc123',
          },
        },
      ]);

      await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO' }, {}, resolve);
      });

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    it('should return error when explicit tabId fails to resolve', async () => {
      mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));
      mockChrome.tabs.query.mockResolvedValue([]);

      const response = await new Promise((resolve) => {
        messageHandler({ type: 'GET_VIDEO_INFO', tabId: 999 }, {}, resolve);
      });

      expect(response).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'Not on YouTube video page',
      });
    });
  });
});
