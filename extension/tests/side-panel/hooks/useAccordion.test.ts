import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAccordion } from '../../../src/side-panel/hooks/useAccordion';
import { setupChromeMock, resetChromeMock, chromeMock } from '../../mocks/chrome';
import type { AccordionItem } from '../../../src/types/accordion';

// Mock dependencies
vi.mock('../../../src/utils/accordionStorage', () => ({
  getAccordionItems: vi.fn(),
  upsertAccordionItem: vi.fn(),
  removeAccordionItem: vi.fn(),
  getMostRecentItemForVideo: vi.fn(),
  buildItemId: vi.fn((videoId: string, promptId: string) => `${videoId}_${promptId}`),
  getAccordionItem: vi.fn(),
  parseItemId: vi.fn((id: string) => {
    const parts = id.split('_');
    if (parts.length < 2) return null;
    return { videoId: parts[0], promptId: parts.slice(1).join('_') };
  }),
}));

vi.mock('../../../src/utils/promptStorage', () => ({
  getDefaultPromptId: vi.fn(),
  getPromptById: vi.fn(),
  getDefaultPromptAndModel: vi.fn(),
}));

vi.mock('../../../src/utils/migration', () => ({
  migrateOldCache: vi.fn(),
}));

import {
  getAccordionItems,
  upsertAccordionItem,
  removeAccordionItem,
  getMostRecentItemForVideo,
  getAccordionItem,
} from '../../../src/utils/accordionStorage';
import { getDefaultPromptId, getPromptById, getDefaultPromptAndModel } from '../../../src/utils/promptStorage';
import { migrateOldCache } from '../../../src/utils/migration';

setupChromeMock();

const mockAccordionItems = getAccordionItems as ReturnType<typeof vi.fn>;
const mockUpsertAccordionItem = upsertAccordionItem as ReturnType<typeof vi.fn>;
const mockRemoveAccordionItem = removeAccordionItem as ReturnType<typeof vi.fn>;
const mockGetMostRecentItem = getMostRecentItemForVideo as ReturnType<typeof vi.fn>;
const mockGetAccordionItem = getAccordionItem as ReturnType<typeof vi.fn>;
const mockGetDefaultPromptId = getDefaultPromptId as ReturnType<typeof vi.fn>;
const mockGetPromptById = getPromptById as ReturnType<typeof vi.fn>;
const mockGetDefaultPromptAndModel = getDefaultPromptAndModel as ReturnType<typeof vi.fn>;
const mockMigrateOldCache = migrateOldCache as ReturnType<typeof vi.fn>;

const sampleItem: AccordionItem = {
  id: 'video1_prompt1',
  videoId: 'video1',
  videoTitle: 'Test Video',
  videoUrl: 'https://youtube.com/watch?v=video1',
  promptId: 'prompt1',
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  summary: 'Test summary',
  timestamp: Date.now(),
};

const defaultPrompt = {
  id: 'prompt1',
  name: 'Default Summary',
  text: 'Summarize this video',
  model: 'openai/gpt-4o-mini',
  isDefault: true,
};

describe('useAccordion', () => {
  beforeEach(() => {
    resetChromeMock();
    vi.clearAllMocks();

    // Default mock implementations
    mockAccordionItems.mockResolvedValue([]);
    mockUpsertAccordionItem.mockResolvedValue(undefined);
    mockRemoveAccordionItem.mockResolvedValue(undefined);
    mockGetMostRecentItem.mockResolvedValue(null);
    mockGetAccordionItem.mockResolvedValue(null);
    mockGetDefaultPromptId.mockResolvedValue('prompt1');
    mockGetPromptById.mockResolvedValue(defaultPrompt);
    mockGetDefaultPromptAndModel.mockResolvedValue({ promptId: 'prompt1', modelId: 'openai/gpt-4o-mini' });
    mockMigrateOldCache.mockResolvedValue(undefined);

    // Default Chrome mock setup - not on YouTube
    chromeMock.tabs.query.mockResolvedValue([{
      id: 1,
      url: 'https://google.com',
      title: 'Google',
    }]);

    chromeMock.runtime.sendMessage.mockResolvedValue({
      type: 'VIDEO_INFO_ERROR',
      error: 'Not on YouTube',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should start with isInitializing true', () => {
      const { result } = renderHook(() => useAccordion());
      expect(result.current.isInitializing).toBe(true);
    });

    it('should run migration on mount', async () => {
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://google.com' }]);

      renderHook(() => useAccordion());

      await waitFor(() => {
        expect(mockMigrateOldCache).toHaveBeenCalled();
      });
    });

    it('should load items from storage on mount', async () => {
      mockAccordionItems.mockResolvedValue([sampleItem]);
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://google.com' }]);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      expect(mockAccordionItems).toHaveBeenCalled();
      expect(result.current.items).toEqual([sampleItem]);
    });

    it('should set currentVideoId when on YouTube video page', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=abc123',
      }]);
      mockGetMostRecentItem.mockResolvedValue(sampleItem);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      expect(result.current.currentVideoId).toBe('abc123');
    });

    it('should expand existing item when video has summary', async () => {
      const existingItem = { ...sampleItem, id: 'abc123_prompt1', videoId: 'abc123' };
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=abc123',
      }]);
      mockGetMostRecentItem.mockResolvedValue(existingItem);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      expect(result.current.expandedIds.has('abc123_prompt1')).toBe(true);
    });

    it('should set error when on YouTube but not video page', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/feed/subscriptions',
      }]);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      expect(result.current.error).toBe('Navigate to a YouTube video to get a summary.');
    });
  });

  describe('toggleItem', () => {
    it('should expand collapsed item', async () => {
      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.toggleItem('item1');
      });

      expect(result.current.expandedIds.has('item1')).toBe(true);
    });

    it('should collapse expanded item', async () => {
      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.toggleItem('item1');
      });

      act(() => {
        result.current.toggleItem('item1');
      });

      expect(result.current.expandedIds.has('item1')).toBe(false);
    });
  });

  describe('deleteItem', () => {
    it('should remove item from storage', async () => {
      mockAccordionItems.mockResolvedValue([sampleItem]);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.items).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteItem('video1_prompt1');
      });

      expect(mockRemoveAccordionItem).toHaveBeenCalledWith('video1_prompt1');
    });

    it('should remove item from expandedIds', async () => {
      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.toggleItem('video1_prompt1');
      });

      expect(result.current.expandedIds.has('video1_prompt1')).toBe(true);

      await act(async () => {
        await result.current.deleteItem('video1_prompt1');
      });

      expect(result.current.expandedIds.has('video1_prompt1')).toBe(false);
    });

    it('should clear item error on delete', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=video1',
      }]);
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'SUMMARY_ERROR',
        error: 'API_ERROR',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      // Delete should clear errors
      await act(async () => {
        await result.current.deleteItem('video1_prompt1');
      });

      expect(result.current.itemErrors.has('video1_prompt1')).toBe(false);
    });
  });

  describe('generateSummary', () => {
    beforeEach(() => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=video1',
      }]);
    });

    it('should set error when prompt not found', async () => {
      mockGetPromptById.mockResolvedValue(null);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      await act(async () => {
        await result.current.generateSummary('video1', 'Title', 'https://url', 'invalid', 'model');
      });

      expect(result.current.error).toBe('Prompt not found');
    });

    it('should add streaming item for new summary', async () => {
      // Mock port for streaming - never sends complete
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('newvideo', 'New Title', 'https://url', 'prompt1', 'openai/gpt-4o-mini');
      });

      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(1);
      });

      const streaming = result.current.streamingItems.get('newvideo_prompt1');
      expect(streaming?.videoTitle).toBe('New Title');
      expect(streaming?.promptName).toBe('Default Summary');
    });

    it('should add to streamingItems for model change', async () => {
      mockAccordionItems.mockResolvedValue([sampleItem]);
      chromeMock.runtime.sendMessage.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        void result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'new-model', true);
      });

      await waitFor(() => {
        expect(result.current.streamingItems.has('video1_prompt1')).toBe(true);
      });

      const streaming = result.current.streamingItems.get('video1_prompt1');
      expect(streaming?.modelId).toBe('new-model');
      expect(streaming?.status).toBe('streaming');
    });

    it('should save item on success', async () => {
      // Setup port mock with immediate completion
      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'openai/gpt-4o-mini');
      });

      // Wait for streaming item to be added (confirms startStream was called)
      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(1);
      });

      // Simulate stream completion
      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'video1',
          videoTitle: 'Video Title',
          promptId: 'prompt1',
          modelId: 'openai/gpt-4o-mini',
          fullContent: 'Generated summary',
        });
      });

      await waitFor(() => {
        expect(mockUpsertAccordionItem).toHaveBeenCalledWith(expect.objectContaining({
          videoId: 'video1',
          summary: 'Generated summary',
        }));
      });
    });

    it('should auto-expand new item on success', async () => {
      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'openai/gpt-4o-mini');
      });

      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'video1',
          videoTitle: 'Video Title',
          promptId: 'prompt1',
          modelId: 'openai/gpt-4o-mini',
          fullContent: 'Generated summary',
        });
      });

      await waitFor(() => {
        expect(result.current.expandedIds.has('video1_prompt1')).toBe(true);
      });
    });

    it('should set streaming item to error state on API failure', async () => {
      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'model');
      });

      // Wait for streaming item to be added (confirms startStream was called)
      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(1);
      });

      act(() => {
        messageListener?.({
          type: 'STREAM_ERROR',
          error: 'NO_API_KEY',
          partialContent: null,
          videoId: 'video1',
          promptId: 'prompt1',
        });
      });

      // Errors are now stored in the streaming item with status 'error'
      await waitFor(() => {
        const streamingItem = result.current.streamingItems.get('video1_prompt1');
        expect(streamingItem).toBeDefined();
        expect(streamingItem?.status).toBe('error');
        expect(streamingItem?.error).toBe('Please add your API key in settings.');
      });
    });

    it('should set streaming item to error state on model change failure', async () => {
      mockAccordionItems.mockResolvedValue([sampleItem]);
      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'new-model', true);
      });

      // For model changes, streamingItems is set
      await waitFor(() => {
        expect(result.current.streamingItems.has('video1_prompt1')).toBe(true);
      });

      act(() => {
        messageListener?.({
          type: 'STREAM_ERROR',
          error: 'API_ERROR',
          partialContent: null,
          videoId: 'video1',
          promptId: 'prompt1',
        });
      });

      // After error, streaming item stays with error status (allows retry with same model)
      await waitFor(() => {
        const streamingItem = result.current.streamingItems.get('video1_prompt1');
        expect(streamingItem).toBeDefined();
        expect(streamingItem?.status).toBe('error');
        expect(streamingItem?.error).toBe('Failed to generate summary. Please try again.');
      });
    });

    it('should remove streaming item after completion', async () => {
      // We'll use a mock port that simulates completion
      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'model');
      });

      // Wait for streaming item to be added
      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(1);
      });

      // Simulate stream completion
      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'video1',
          videoTitle: 'Title',
          promptId: 'prompt1',
          modelId: 'model',
          fullContent: 'Summary',
        });
      });

      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(0);
      });
    });

    it('should clear streamingItems after model change completion', async () => {
      mockAccordionItems.mockResolvedValue([sampleItem]);
      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        result.current.generateSummary('video1', 'Title', 'https://url', 'prompt1', 'model', true);
      });

      // Wait for streaming item to be added
      await waitFor(() => {
        expect(result.current.streamingItems.has('video1_prompt1')).toBe(true);
      });

      // Simulate stream completion
      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'video1',
          videoTitle: 'Title',
          promptId: 'prompt1',
          modelId: 'model',
          fullContent: 'Summary',
        });
      });

      await waitFor(() => {
        expect(result.current.streamingItems.has('video1_prompt1')).toBe(false);
      });
    });
  });

  describe('retryItem', () => {
    it('should retry with existing item data', async () => {
      const existingItem = { ...sampleItem };
      mockGetAccordionItem.mockResolvedValue(existingItem);
      // Return existing item so hook doesn't auto-generate during init
      mockGetMostRecentItem.mockResolvedValue(existingItem);
      mockAccordionItems.mockResolvedValue([existingItem]);

      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=video1',
      }]);

      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        void result.current.retryItem('video1_prompt1');
      });

      // For existing accordion items, retryItem uses isModelChange=true, so streamingItems is set
      await waitFor(() => {
        expect(mockGetAccordionItem).toHaveBeenCalledWith('video1', 'prompt1');
      });

      await waitFor(() => {
        expect(result.current.streamingItems.has('video1_prompt1')).toBe(true);
      });

      // Simulate stream completion
      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'video1',
          videoTitle: 'Title',
          promptId: 'prompt1',
          modelId: 'openai/gpt-4o-mini',
          fullContent: 'Retried summary',
        });
      });

      await waitFor(() => {
        expect(mockUpsertAccordionItem).toHaveBeenCalled();
      });
    });

    it('should do nothing for invalid item id', async () => {
      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      await act(async () => {
        await result.current.retryItem('invalid');
      });

      expect(mockGetAccordionItem).not.toHaveBeenCalled();
    });
  });

  describe('generateForCurrentVideo', () => {
    it('should generate with default prompt for current video', async () => {
      // Mock existing item for a different video so hook doesn't auto-generate for current123
      const existingItem = { ...sampleItem, id: 'current123_prompt1', videoId: 'current123' };
      mockGetMostRecentItem.mockResolvedValue(existingItem);
      mockAccordionItems.mockResolvedValue([existingItem]);

      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=current123',
      }]);

      // Mock video info response
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'current123',
        videoTitle: 'Current Video',
        videoUrl: 'https://youtube.com/watch?v=current123',
      });

      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      act(() => {
        void result.current.generateForCurrentVideo('prompt1', 'openai/gpt-4o-mini');
      });

      // Wait for streaming item to be added
      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(1);
      });

      // Simulate stream completion
      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'current123',
          videoTitle: 'Current Video',
          promptId: 'prompt1',
          modelId: 'openai/gpt-4o-mini',
          fullContent: 'Summary',
        });
      });

      await waitFor(() => {
        expect(mockUpsertAccordionItem).toHaveBeenCalled();
      });
    });

    it('should do nothing when not on video page', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/feed/subscriptions',
      }]);

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      await act(async () => {
        await result.current.generateForCurrentVideo('prompt1', 'openai/gpt-4o-mini');
      });

      // When not on a video page, it should not trigger any summary generation
      expect(result.current.streamingItems.size).toBe(0);
    });
  });

  describe('storage listener', () => {
    it('should reload items when storage changes', async () => {
      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      expect(chromeMock.storage.local.onChanged.addListener).toHaveBeenCalled();

      // Simulate storage change
      const listener = chromeMock.storage.local.onChanged.addListener.mock.calls[0]![0] as (
        changes: Record<string, unknown>
      ) => void;

      mockAccordionItems.mockResolvedValue([sampleItem]);

      await act(async () => {
        listener({ accordionItems: { newValue: [sampleItem] } });
      });

      await waitFor(() => {
        expect(result.current.items).toEqual([sampleItem]);
      });
    });

    it('should not reload for unrelated storage changes', async () => {
      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      const initialCallCount = mockAccordionItems.mock.calls.length;

      const listener = chromeMock.storage.local.onChanged.addListener.mock.calls[0]![0] as (
        changes: Record<string, unknown>
      ) => void;

      await act(async () => {
        listener({ otherKey: { newValue: 'something' } });
      });

      // Should not have called getAccordionItems again
      expect(mockAccordionItems.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('isUsableTitle helper', () => {
    it('should use title from video info when valid', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://youtube.com/watch?v=video1',
      }]);

      // The onComplete callback calls fetchVideoInfo to refresh the title
      // Since the stream completes with "Unknown" (unusable), it should use the refreshed title
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'video1',
        videoTitle: 'Refreshed Title',
        videoUrl: 'https://youtube.com/watch?v=video1',
      });

      let messageListener: ((message: unknown) => void) | null = null;
      chromeMock.runtime.connect.mockReturnValue({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn((cb: (message: unknown) => void) => { messageListener = cb; }) },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
        name: 'streaming',
      });

      const { result } = renderHook(() => useAccordion());

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false);
      });

      // Trigger a summary generation
      act(() => {
        result.current.generateSummary('video1', 'Unknown', 'https://youtube.com/watch?v=video1', 'prompt1', 'model');
      });

      await waitFor(() => {
        expect(result.current.streamingItems.size).toBe(1);
      });

      // Simulate stream completion with unusable title
      act(() => {
        messageListener?.({
          type: 'STREAM_COMPLETE',
          videoId: 'video1',
          videoTitle: 'Unknown',
          promptId: 'prompt1',
          modelId: 'model',
          fullContent: 'Summary',
        });
      });

      // Should use the refreshed title, not "Unknown"
      await waitFor(() => {
        expect(mockUpsertAccordionItem).toHaveBeenCalledWith(
          expect.objectContaining({
            videoTitle: 'Refreshed Title',
          })
        );
      });
    });
  });
});
