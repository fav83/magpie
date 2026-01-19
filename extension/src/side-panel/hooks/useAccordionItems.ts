import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccordionItem } from '../../types/accordion';
import type { StreamingItem } from '../../types/streaming';
import {
  getAccordionItems,
  removeAccordionItem,
  clearAccordion,
} from '../../utils/accordionStorage';
import { STORAGE_KEYS } from '../../config';

export interface UseAccordionItemsReturn {
  items: AccordionItem[];
  expandedIds: Set<string>;
  streamingItems: Map<string, StreamingItem>;
  itemErrors: Map<string, string>;
  loadItems: () => Promise<void>;
  toggleItem: (id: string) => void;
  expandItem: (id: string) => void;
  collapseItem: (id: string) => void;
  collapseOtherVideos: (currentVideoId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setStreamingItems: React.Dispatch<React.SetStateAction<Map<string, StreamingItem>>>;
  getStreamingItems: () => Map<string, StreamingItem>;
  deleteItem: (id: string, cancelStream: () => void) => Promise<void>;
  deleteAllItems: (cancelAllStreams: () => void) => Promise<void>;
  clearItemError: (itemId: string) => void;
  setItemError: (itemId: string, errorMessage: string) => void;
}

/**
 * Manages accordion items state: items list, expansion state, streaming items, and errors.
 * Provides operations for loading, toggling, deleting, and error management.
 *
 * State is intentionally kept as separate useState calls rather than useReducer because:
 * 1. Items are loaded asynchronously from Chrome storage
 * 2. State pieces are mostly independent (expandedIds, streamingItems, itemErrors)
 * 3. Individual operations are already atomic and clearly named
 */
export function useAccordionItems(): UseAccordionItemsReturn {
  const [items, setItems] = useState<AccordionItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [streamingItems, setStreamingItems] = useState<Map<string, StreamingItem>>(new Map());
  const [itemErrors, setItemErrors] = useState<Map<string, string>>(new Map());

  // Ref for stable access to current streaming items (used in callbacks)
  const streamingItemsRef = useRef(streamingItems);
  streamingItemsRef.current = streamingItems;

  // Load items from storage
  const loadItems = useCallback(async () => {
    const storedItems = await getAccordionItems();
    setItems(storedItems);
  }, []);

  // Toggle expansion state
  const toggleItem = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand a specific item
  const expandItem = useCallback((id: string) => {
    setExpandedIds((prev) => new Set(prev).add(id));
  }, []);

  // Collapse a specific item
  const collapseItem = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Collapse all items for videos other than the current one
  const collapseOtherVideos = useCallback((currentVideoId: string) => {
    setExpandedIds((prev) => {
      const next = new Set<string>();

      // Keep only expanded items that belong to the current video
      for (const id of prev) {
        // Check persisted items
        const item = items.find((i) => i.id === id);
        if (item?.videoId === currentVideoId) {
          next.add(id);
          continue;
        }
        // Check streaming items
        const streaming = streamingItems.get(id);
        if (streaming?.videoId === currentVideoId) {
          next.add(id);
        }
      }

      return next;
    });
  }, [items, streamingItems]);

  // Expand all items
  const expandAll = useCallback(() => {
    setExpandedIds(() => {
      const allIds = new Set<string>();
      items.forEach((item) => allIds.add(item.id));
      streamingItems.forEach((_, id) => allIds.add(id));
      return allIds;
    });
  }, [items, streamingItems]);

  // Collapse all items
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Delete an item (handles both persisted and streaming items)
  const deleteItem = useCallback(async (id: string, cancelStream: () => void) => {
    // If it's a streaming item, cancel the stream first
    if (streamingItems.has(id)) {
      cancelStream();
      setStreamingItems((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } else {
      // Persisted item
      await removeAccordionItem(id);
      await loadItems();
    }

    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Clear any error for this item
    setItemErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, [loadItems, streamingItems]);

  // Delete all items (handles both persisted and streaming items)
  const deleteAllItems = useCallback(async (cancelAllStreams: () => void) => {
    // Cancel all streaming items first
    cancelAllStreams();
    setStreamingItems(new Map());

    // Clear all persisted items
    await clearAccordion();
    setItems([]);

    // Clear all expansion state and errors
    setExpandedIds(new Set());
    setItemErrors(new Map());
  }, []);

  // Clear item error
  const clearItemError = useCallback((itemId: string) => {
    setItemErrors((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  // Set item error
  const setItemError = useCallback((itemId: string, errorMessage: string) => {
    setItemErrors((prev) => {
      const next = new Map(prev);
      next.set(itemId, errorMessage);
      return next;
    });
  }, []);

  // Stable getter for current streaming items (avoids stale closure issues)
  const getStreamingItems = useCallback(() => streamingItemsRef.current, []);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[STORAGE_KEYS.ACCORDION_ITEMS]) {
        void loadItems();
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, [loadItems]);

  return {
    items,
    expandedIds,
    streamingItems,
    itemErrors,
    loadItems,
    toggleItem,
    expandItem,
    collapseItem,
    collapseOtherVideos,
    expandAll,
    collapseAll,
    setExpandedIds,
    setStreamingItems,
    getStreamingItems,
    deleteItem,
    deleteAllItems,
    clearItemError,
    setItemError,
  };
}
