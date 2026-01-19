import { useState, useCallback } from 'react';
import type { AccordionItem } from '../../types/accordion';
import type { StreamingItem } from '../../types/streaming';
import { useAccordionItems } from './useAccordionItems';
import { useStreamingSummary } from './useStreamingSummary';
import { useVideoNavigation } from './useVideoNavigation';

export interface UseAccordionReturn {
  items: AccordionItem[];
  currentVideoId: string | null;
  currentTabId: number | null;
  expandedIds: Set<string>;
  streamingItems: Map<string, StreamingItem>;
  error: string;
  itemErrors: Map<string, string>;
  isInitializing: boolean;
  toggleItem: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  deleteItem: (id: string) => Promise<void>;
  deleteAllItems: () => Promise<void>;
  generateSummary: (
    videoId: string,
    videoTitle: string,
    videoUrl: string,
    promptId: string,
    modelId: string,
    isModelChange?: boolean,
    replaceItemId?: string,
    customPromptText?: string
  ) => void;
  generateForCurrentVideo: (promptId: string, modelId: string) => Promise<void>;
  retryItem: (itemId: string) => Promise<void>;
  cancelStream: (itemId: string) => void;
}

/**
 * Main accordion hook that composes smaller specialized hooks.
 * Manages the accordion UI state for YouTube video summaries.
 */
export function useAccordion(): UseAccordionReturn {
  // Global error state - shared between streaming and navigation
  const [error, setError] = useState('');

  // Item state management (items, expanded, streaming, errors)
  const {
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
    setStreamingItems,
    getStreamingItems,
    deleteItem: deleteItemBase,
    deleteAllItems: deleteAllItemsBase,
    clearItemError,
    setItemError,
  } = useAccordionItems();

  // Streaming summary generation
  const {
    generateSummary,
    cancelStream,
    stopAllStreamsForOtherVideos,
    retryItem,
    currentTabIdRef,
  } = useStreamingSummary({
    loadItems,
    clearItemError,
    setItemError,
    setError,
    setStreamingItems,
    expandItem,
    collapseItem,
    getStreamingItems,
  });

  // Video navigation handling
  const {
    currentVideoId,
    error: navigationError,
    isInitializing,
    generateForCurrentVideo,
  } = useVideoNavigation({
    loadItems,
    generateSummary,
    expandItem,
    stopAllStreamsForOtherVideos,
    collapseOtherVideos,
    currentTabIdRef,
  });

  // Merge errors - navigation error takes precedence if set
  const displayError = navigationError || error;

  // Wrap deleteItem to pass cancelStream
  const deleteItem = useCallback(
    async (id: string) => {
      await deleteItemBase(id, () => {
        cancelStream(id);
      });
    },
    [deleteItemBase, cancelStream]
  );

  // Wrap deleteAllItems to cancel all streams
  const deleteAllItems = useCallback(
    async () => {
      await deleteAllItemsBase(() => {
        // Cancel all streaming items
        getStreamingItems().forEach((_, id) => {
          cancelStream(id);
        });
      });
    },
    [deleteAllItemsBase, cancelStream, getStreamingItems]
  );

  return {
    items,
    currentVideoId,
    currentTabId: currentTabIdRef.current,
    expandedIds,
    streamingItems,
    error: displayError,
    itemErrors,
    isInitializing,
    toggleItem,
    expandAll,
    collapseAll,
    deleteItem,
    deleteAllItems,
    generateSummary,
    generateForCurrentVideo,
    retryItem,
    cancelStream,
  };
}
