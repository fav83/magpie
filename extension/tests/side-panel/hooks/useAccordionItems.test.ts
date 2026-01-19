import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAccordionItems } from '../../../src/side-panel/hooks/useAccordionItems';
import { setupChromeMock, resetChromeMock, chromeMock } from '../../mocks/chrome';
import type { AccordionItem } from '../../../src/types/accordion';
import type { StreamingItem } from '../../../src/types/streaming';
import { STORAGE_KEYS } from '../../../src/config';

// Mock dependencies
vi.mock('../../../src/utils/accordionStorage', () => ({
  getAccordionItems: vi.fn(),
  removeAccordionItem: vi.fn(),
}));

import { getAccordionItems, removeAccordionItem } from '../../../src/utils/accordionStorage';

setupChromeMock();

const mockGetAccordionItems = getAccordionItems as ReturnType<typeof vi.fn>;
const mockRemoveAccordionItem = removeAccordionItem as ReturnType<typeof vi.fn>;

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

const sampleStreamingItem: StreamingItem = {
  id: 'video2_prompt1',
  videoId: 'video2',
  videoTitle: 'Streaming Video',
  videoUrl: 'https://youtube.com/watch?v=video2',
  promptId: 'prompt1',
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  content: 'Streaming content...',
  fullContent: 'Streaming content...',
  status: 'streaming',
};

describe('useAccordionItems', () => {
  beforeEach(() => {
    resetChromeMock();
    vi.clearAllMocks();
    mockGetAccordionItems.mockResolvedValue([]);
    mockRemoveAccordionItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty items array', () => {
      const { result } = renderHook(() => useAccordionItems());
      expect(result.current.items).toEqual([]);
    });

    it('should start with empty expandedIds set', () => {
      const { result } = renderHook(() => useAccordionItems());
      expect(result.current.expandedIds.size).toBe(0);
    });

    it('should start with empty streamingItems map', () => {
      const { result } = renderHook(() => useAccordionItems());
      expect(result.current.streamingItems.size).toBe(0);
    });

    it('should start with empty itemErrors map', () => {
      const { result } = renderHook(() => useAccordionItems());
      expect(result.current.itemErrors.size).toBe(0);
    });
  });

  describe('loadItems', () => {
    it('should load items from storage', async () => {
      mockGetAccordionItems.mockResolvedValue([sampleItem]);
      const { result } = renderHook(() => useAccordionItems());

      await act(async () => {
        await result.current.loadItems();
      });

      expect(result.current.items).toEqual([sampleItem]);
      expect(mockGetAccordionItems).toHaveBeenCalled();
    });

    it('should replace existing items when loading', async () => {
      const items1 = [{ ...sampleItem, id: 'item1' }];
      const items2 = [{ ...sampleItem, id: 'item2' }];

      mockGetAccordionItems.mockResolvedValueOnce(items1).mockResolvedValueOnce(items2);
      const { result } = renderHook(() => useAccordionItems());

      await act(async () => {
        await result.current.loadItems();
      });
      expect(result.current.items).toEqual(items1);

      await act(async () => {
        await result.current.loadItems();
      });
      expect(result.current.items).toEqual(items2);
    });
  });

  describe('toggleItem', () => {
    it('should expand item when not expanded', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.toggleItem('item1');
      });

      expect(result.current.expandedIds.has('item1')).toBe(true);
    });

    it('should collapse item when already expanded', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.toggleItem('item1');
      });
      expect(result.current.expandedIds.has('item1')).toBe(true);

      act(() => {
        result.current.toggleItem('item1');
      });
      expect(result.current.expandedIds.has('item1')).toBe(false);
    });

    it('should handle multiple items independently', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.toggleItem('item1');
        result.current.toggleItem('item2');
      });

      expect(result.current.expandedIds.has('item1')).toBe(true);
      expect(result.current.expandedIds.has('item2')).toBe(true);

      act(() => {
        result.current.toggleItem('item1');
      });

      expect(result.current.expandedIds.has('item1')).toBe(false);
      expect(result.current.expandedIds.has('item2')).toBe(true);
    });
  });

  describe('expandItem', () => {
    it('should expand item', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.expandItem('item1');
      });

      expect(result.current.expandedIds.has('item1')).toBe(true);
    });

    it('should not affect already expanded item', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.expandItem('item1');
        result.current.expandItem('item1');
      });

      expect(result.current.expandedIds.has('item1')).toBe(true);
      expect(result.current.expandedIds.size).toBe(1);
    });
  });

  describe('deleteItem', () => {
    it('should delete persisted item from storage', async () => {
      mockGetAccordionItems.mockResolvedValue([sampleItem]);
      const { result } = renderHook(() => useAccordionItems());
      const cancelStream = vi.fn();

      await act(async () => {
        await result.current.loadItems();
      });

      await act(async () => {
        await result.current.deleteItem(sampleItem.id, cancelStream);
      });

      expect(mockRemoveAccordionItem).toHaveBeenCalledWith(sampleItem.id);
      expect(cancelStream).not.toHaveBeenCalled();
    });

    it('should cancel stream and remove streaming item', async () => {
      const { result } = renderHook(() => useAccordionItems());
      const cancelStream = vi.fn();

      // Add streaming item
      act(() => {
        result.current.setStreamingItems((prev) => {
          const next = new Map(prev);
          next.set(sampleStreamingItem.id, sampleStreamingItem);
          return next;
        });
      });

      expect(result.current.streamingItems.has(sampleStreamingItem.id)).toBe(true);

      await act(async () => {
        await result.current.deleteItem(sampleStreamingItem.id, cancelStream);
      });

      expect(cancelStream).toHaveBeenCalled();
      expect(result.current.streamingItems.has(sampleStreamingItem.id)).toBe(false);
      expect(mockRemoveAccordionItem).not.toHaveBeenCalled();
    });

    it('should remove item from expandedIds', async () => {
      const { result } = renderHook(() => useAccordionItems());
      const cancelStream = vi.fn();

      act(() => {
        result.current.expandItem('item1');
      });
      expect(result.current.expandedIds.has('item1')).toBe(true);

      await act(async () => {
        await result.current.deleteItem('item1', cancelStream);
      });

      expect(result.current.expandedIds.has('item1')).toBe(false);
    });

    it('should clear item error when deleting', async () => {
      const { result } = renderHook(() => useAccordionItems());
      const cancelStream = vi.fn();

      act(() => {
        result.current.setItemError('item1', 'Some error');
      });
      expect(result.current.itemErrors.has('item1')).toBe(true);

      await act(async () => {
        await result.current.deleteItem('item1', cancelStream);
      });

      expect(result.current.itemErrors.has('item1')).toBe(false);
    });
  });

  describe('error management', () => {
    it('should set item error', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.setItemError('item1', 'Error message');
      });

      expect(result.current.itemErrors.get('item1')).toBe('Error message');
    });

    it('should clear item error', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.setItemError('item1', 'Error message');
      });
      expect(result.current.itemErrors.has('item1')).toBe(true);

      act(() => {
        result.current.clearItemError('item1');
      });
      expect(result.current.itemErrors.has('item1')).toBe(false);
    });

    it('should handle multiple errors independently', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.setItemError('item1', 'Error 1');
        result.current.setItemError('item2', 'Error 2');
      });

      expect(result.current.itemErrors.get('item1')).toBe('Error 1');
      expect(result.current.itemErrors.get('item2')).toBe('Error 2');

      act(() => {
        result.current.clearItemError('item1');
      });

      expect(result.current.itemErrors.has('item1')).toBe(false);
      expect(result.current.itemErrors.get('item2')).toBe('Error 2');
    });
  });

  describe('storage change listener', () => {
    it('should reload items when accordion items change in storage', async () => {
      mockGetAccordionItems.mockResolvedValue([sampleItem]);
      renderHook(() => useAccordionItems());

      // Simulate storage change
      const listeners = chromeMock.storage.local.onChanged.addListener.mock.calls;
      expect(listeners.length).toBeGreaterThan(0);

      const listener = listeners[0]![0];

      await act(async () => {
        listener({ [STORAGE_KEYS.ACCORDION_ITEMS]: { newValue: [sampleItem] } });
      });

      await waitFor(() => {
        expect(mockGetAccordionItems).toHaveBeenCalled();
      });
    });

    it('should not reload items for other storage changes', async () => {
      renderHook(() => useAccordionItems());
      mockGetAccordionItems.mockClear();

      const listeners = chromeMock.storage.local.onChanged.addListener.mock.calls;
      const listener = listeners[0]![0];

      await act(async () => {
        listener({ someOtherKey: { newValue: 'something' } });
      });

      expect(mockGetAccordionItems).not.toHaveBeenCalled();
    });

    it('should remove listener on unmount', () => {
      const { unmount } = renderHook(() => useAccordionItems());

      unmount();

      expect(chromeMock.storage.local.onChanged.removeListener).toHaveBeenCalled();
    });
  });

  describe('setStreamingItems', () => {
    it('should update streaming items', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.setStreamingItems((prev) => {
          const next = new Map(prev);
          next.set(sampleStreamingItem.id, sampleStreamingItem);
          return next;
        });
      });

      expect(result.current.streamingItems.get(sampleStreamingItem.id)).toEqual(sampleStreamingItem);
    });
  });

  describe('setExpandedIds', () => {
    it('should update expanded ids', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.setExpandedIds(new Set(['item1', 'item2']));
      });

      expect(result.current.expandedIds.has('item1')).toBe(true);
      expect(result.current.expandedIds.has('item2')).toBe(true);
    });
  });

  describe('expandAll', () => {
    it('should expand all persisted items', async () => {
      const items = [
        { ...sampleItem, id: 'item1' },
        { ...sampleItem, id: 'item2' },
        { ...sampleItem, id: 'item3' },
      ];
      mockGetAccordionItems.mockResolvedValue(items);
      const { result } = renderHook(() => useAccordionItems());

      await act(async () => {
        await result.current.loadItems();
      });

      act(() => {
        result.current.expandAll();
      });

      expect(result.current.expandedIds.size).toBe(3);
      expect(result.current.expandedIds.has('item1')).toBe(true);
      expect(result.current.expandedIds.has('item2')).toBe(true);
      expect(result.current.expandedIds.has('item3')).toBe(true);
    });

    it('should expand all streaming items', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.setStreamingItems((prev) => {
          const next = new Map(prev);
          next.set('stream1', { ...sampleStreamingItem, id: 'stream1' });
          next.set('stream2', { ...sampleStreamingItem, id: 'stream2' });
          return next;
        });
      });

      act(() => {
        result.current.expandAll();
      });

      expect(result.current.expandedIds.size).toBe(2);
      expect(result.current.expandedIds.has('stream1')).toBe(true);
      expect(result.current.expandedIds.has('stream2')).toBe(true);
    });

    it('should expand both persisted and streaming items', async () => {
      mockGetAccordionItems.mockResolvedValue([sampleItem]);
      const { result } = renderHook(() => useAccordionItems());

      await act(async () => {
        await result.current.loadItems();
      });

      act(() => {
        result.current.setStreamingItems((prev) => {
          const next = new Map(prev);
          next.set(sampleStreamingItem.id, sampleStreamingItem);
          return next;
        });
      });

      act(() => {
        result.current.expandAll();
      });

      expect(result.current.expandedIds.size).toBe(2);
      expect(result.current.expandedIds.has(sampleItem.id)).toBe(true);
      expect(result.current.expandedIds.has(sampleStreamingItem.id)).toBe(true);
    });

    it('should handle empty items gracefully', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.expandAll();
      });

      expect(result.current.expandedIds.size).toBe(0);
    });
  });

  describe('collapseAll', () => {
    it('should collapse all expanded items', () => {
      const { result } = renderHook(() => useAccordionItems());

      act(() => {
        result.current.expandItem('item1');
        result.current.expandItem('item2');
        result.current.expandItem('item3');
      });
      expect(result.current.expandedIds.size).toBe(3);

      act(() => {
        result.current.collapseAll();
      });

      expect(result.current.expandedIds.size).toBe(0);
    });

    it('should handle already empty expandedIds', () => {
      const { result } = renderHook(() => useAccordionItems());
      expect(result.current.expandedIds.size).toBe(0);

      act(() => {
        result.current.collapseAll();
      });

      expect(result.current.expandedIds.size).toBe(0);
    });
  });
});
