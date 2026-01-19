import { useCallback, useRef } from 'react';
import type { StreamingItem } from '../../types/streaming';
import type { StreamChunk, StreamComplete, StreamError } from '../../types/messages';
import { ERROR_MESSAGES, getErrorMessage, UI_MESSAGES } from '../../config';
import { upsertAccordionItem, buildItemId, getAccordionItem, parseItemId, removeAccordionItem } from '../../utils/accordionStorage';
import { clearVideoChat } from '../../utils/chatStorage';
import { getPromptById } from '../../utils/promptStorage';
import { useStreamingPort } from '../../hooks/useStreamingPort';
import { fetchVideoInfo, isUsableTitle } from '../utils/videoHelpers';
import { logComponent, logError } from '../../utils/logger';

const SUMMARY_LOG = 'StreamingSummary';

export interface StreamingSummaryCallbacks {
  loadItems: () => Promise<void>;
  clearItemError: (itemId: string) => void;
  setItemError: (itemId: string, errorMessage: string) => void;
  setError: (error: string) => void;
  setStreamingItems: React.Dispatch<React.SetStateAction<Map<string, StreamingItem>>>;
  expandItem: (id: string) => void;
  collapseItem: (id: string) => void;
  getStreamingItems: () => Map<string, StreamingItem>;
}

export interface UseStreamingSummaryReturn {
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
  cancelStream: (itemId: string) => void;
  stopAllStreamsForOtherVideos: (currentVideoId: string) => void;
  retryItem: (itemId: string) => Promise<void>;
  currentTabIdRef: React.MutableRefObject<number | null>;
}

/**
 * Manages streaming summary generation, cancellation, and retry logic.
 * Requires callbacks for state updates to integrate with parent hook.
 */
export function useStreamingSummary(callbacks: StreamingSummaryCallbacks): UseStreamingSummaryReturn {
  const currentTabIdRef = useRef<number | null>(null);
  const { startStream, cancelStream: portCancelStream } = useStreamingPort();

  const {
    loadItems,
    clearItemError,
    setItemError,
    setError,
    setStreamingItems,
    expandItem,
    collapseItem,
    getStreamingItems,
  } = callbacks;

  // Generate a summary using streaming
  const generateSummary = useCallback(
    (
      videoId: string,
      videoTitle: string,
      videoUrl: string,
      promptId: string,
      modelId: string,
      isModelChange = false,
      replaceItemId?: string,
      customPromptText?: string
    ) => {
      const itemId = buildItemId(videoId, promptId);
      const targetTabId = currentTabIdRef.current;

      logComponent(SUMMARY_LOG, 'generateSummary:', {
        videoId,
        promptId,
        modelId,
        itemId,
        targetTabId,
      });

      // Async initialization
      void (async () => {
        const prompt = await getPromptById(promptId);
        if (!prompt) {
          logError('Prompt not found:', promptId);
          setError(UI_MESSAGES.PROMPT_NOT_FOUND);
          return;
        }

        if (!targetTabId) {
          logError('No target tab ID');
          const errorMessage = ERROR_MESSAGES.NOT_YOUTUBE_VIDEO;
          if (isModelChange) {
            setItemError(itemId, errorMessage);
          } else {
            setError(errorMessage);
          }
          return;
        }

        // Clear any existing error for this item
        clearItemError(itemId);

        // Clear chat history for this video when regenerating summary
        await clearVideoChat(videoId);

        // Add to streaming items map FIRST (for both new items and model changes)
        // Also clear any errored streaming items for the same video to avoid stale entries
        setStreamingItems((prev) => {
          const next = new Map(prev);
          // Remove errored streaming items for the same video (except the current itemId)
          for (const [existingId, existing] of next) {
            if (existing.videoId === videoId && existing.status === 'error' && existingId !== itemId) {
              next.delete(existingId);
            }
          }
          next.set(itemId, {
            id: itemId,
            videoId,
            videoTitle,
            videoUrl,
            promptId,
            promptName: prompt.name,
            modelId,
            content: '',
            fullContent: '',
            status: 'streaming',
            ...(replaceItemId !== undefined && replaceItemId !== itemId && { replaceItemId }),
          });
          return next;
        });

        // Auto-expand the streaming item (for new items only)
        if (!isModelChange) {
          expandItem(itemId);
        }

        setError('');

        // Start streaming
        startStream(videoId, promptId, modelId, targetTabId, {
          onChunk: (chunk: StreamChunk) => {
            setStreamingItems((prev) => {
              const existing = prev.get(itemId);
              if (!existing) return prev;

              const newFullContent = existing.fullContent + chunk.content;

              // Buffer content until newline for stable rendering
              let newDisplayContent = existing.content;
              const lastNewline = newFullContent.lastIndexOf('\n');
              if (lastNewline !== -1) {
                newDisplayContent = newFullContent.slice(0, lastNewline + 1);
              }

              const next = new Map(prev);
              next.set(itemId, {
                ...existing,
                content: newDisplayContent,
                fullContent: newFullContent,
              });
              return next;
            });
          },

          onComplete: (complete: StreamComplete) => {
            void (async () => {
              // Resolve video title
              let resolvedTitle = complete.videoTitle;
              const refreshedInfo = await fetchVideoInfo(targetTabId);
              if (refreshedInfo?.videoId === videoId && isUsableTitle(refreshedInfo.videoTitle)) {
                resolvedTitle = refreshedInfo.videoTitle;
              } else if (!isUsableTitle(resolvedTitle)) {
                resolvedTitle = videoTitle;
              }

              // If replacing an existing item with a different prompt, delete the old one first
              if (replaceItemId && replaceItemId !== itemId) {
                await removeAccordionItem(replaceItemId);
              }

              // Save to accordion storage
              await upsertAccordionItem({
                videoId,
                videoTitle: resolvedTitle,
                videoUrl,
                promptId: complete.promptId,
                promptName: prompt.name,
                modelId: complete.modelId,
                summary: complete.fullContent,
                ...(customPromptText !== undefined && { customPromptText }),
              });

              // Reload items from storage
              await loadItems();

              // Remove from streaming items
              setStreamingItems((prev) => {
                const next = new Map(prev);
                next.delete(itemId);
                return next;
              });

              // Clear any error
              clearItemError(itemId);
            })();
          },

          onError: (errorResponse: StreamError) => {
            const errorMessage = getErrorMessage(errorResponse.error, errorResponse.errorDetails);

            // Keep streaming item in error state to preserve the selected model
            // But don't overwrite 'stopped' status (set by stopAllStreamsForOtherVideos)
            setStreamingItems((prev) => {
              const existing = prev.get(itemId);
              if (!existing) return prev;

              // If already marked as stopped, don't overwrite with error
              if (existing.status === 'stopped') {
                return prev;
              }

              const next = new Map(prev);
              next.set(itemId, {
                ...existing,
                content: errorResponse.partialContent ?? '',
                fullContent: errorResponse.partialContent ?? '',
                status: 'error',
                error: errorMessage,
              });
              return next;
            });
          },
        }, customPromptText);
      })();
    },
    [loadItems, clearItemError, setItemError, setError, setStreamingItems, expandItem, startStream]
  );

  // Cancel an active stream
  const cancelStream = useCallback(
    (itemId: string) => {
      portCancelStream();

      // Get the streaming item before modifying state
      const streamingItems = getStreamingItems();
      const existing = streamingItems.get(itemId);

      if (!existing) {
        return;
      }

      // If there's content, save it to storage so it maintains its position
      if (existing.fullContent) {
        const errorMessage = getErrorMessage('Cancelled');
        void (async () => {
          // Save partial content to storage (like completion does)
          await upsertAccordionItem({
            videoId: existing.videoId,
            videoTitle: existing.videoTitle,
            videoUrl: existing.videoUrl,
            promptId: existing.promptId,
            promptName: existing.promptName,
            modelId: existing.modelId,
            summary: existing.fullContent,
          });

          // Reload items from storage
          await loadItems();

          // Set error on the saved item
          setItemError(itemId, errorMessage);

          // Remove from streaming items
          setStreamingItems((prev) => {
            const next = new Map(prev);
            next.delete(itemId);
            return next;
          });
        })();
      } else {
        // No content - just remove from streaming items
        setStreamingItems((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [portCancelStream, setStreamingItems, getStreamingItems, loadItems, setItemError]
  );

  // Stop all streams for videos other than the current one (used when switching videos)
  const stopAllStreamsForOtherVideos = useCallback(
    (currentVideoId: string) => {
      const streamingItems = getStreamingItems();
      const itemsToStop: StreamingItem[] = [];

      // Check if there are any streaming items for other videos
      for (const [, item] of streamingItems) {
        if (item.videoId !== currentVideoId && item.status === 'streaming') {
          itemsToStop.push(item);
        }
      }

      if (itemsToStop.length === 0) {
        return;
      }

      // Cancel the port connection (this will abort the actual API request)
      portCancelStream();

      // Collapse all stopped items
      for (const item of itemsToStop) {
        collapseItem(item.id);
      }

      // Save items with content to storage, remove all from streaming items
      const errorMessage = getErrorMessage('Stopped');
      void (async () => {
        const itemsWithContent = itemsToStop.filter(item => item.fullContent);
        const itemIdsToRemove = itemsToStop.map(item => item.id);

        // Save all items with content to storage (maintains their position)
        for (const item of itemsWithContent) {
          await upsertAccordionItem({
            videoId: item.videoId,
            videoTitle: item.videoTitle,
            videoUrl: item.videoUrl,
            promptId: item.promptId,
            promptName: item.promptName,
            modelId: item.modelId,
            summary: item.fullContent,
          });
        }

        // Reload items from storage if any were saved
        if (itemsWithContent.length > 0) {
          await loadItems();

          // Set error on all saved items
          for (const item of itemsWithContent) {
            setItemError(item.id, errorMessage);
          }
        }

        // Remove all stopped items from streaming items
        setStreamingItems((prev) => {
          const next = new Map(prev);
          for (const itemId of itemIdsToRemove) {
            next.delete(itemId);
          }
          return next;
        });
      })();
    },
    [portCancelStream, setStreamingItems, getStreamingItems, collapseItem, loadItems, setItemError]
  );

  // Retry generating summary for an existing item or streaming item with error
  const retryItem = useCallback(
    async (itemId: string) => {
      // First check if it's a streaming item with error
      const streamingItems = getStreamingItems();
      const streamingItem = streamingItems.get(itemId);
      if (streamingItem) {
        // Remove the errored streaming item
        setStreamingItems((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });

        // Retry with the same parameters
        generateSummary(
          streamingItem.videoId,
          streamingItem.videoTitle,
          streamingItem.videoUrl,
          streamingItem.promptId,
          streamingItem.modelId,
          false
        );
        return;
      }

      // Otherwise, it's an existing accordion item
      const parsed = parseItemId(itemId);
      if (!parsed) return;

      const item = await getAccordionItem(parsed.videoId, parsed.promptId);
      if (!item) return;

      // Retry with the same prompt and model
      generateSummary(item.videoId, item.videoTitle, item.videoUrl, item.promptId, item.modelId, true);
    },
    [generateSummary, getStreamingItems, setStreamingItems]
  );

  return {
    generateSummary,
    cancelStream,
    stopAllStreamsForOtherVideos,
    retryItem,
    currentTabIdRef,
  };
}
