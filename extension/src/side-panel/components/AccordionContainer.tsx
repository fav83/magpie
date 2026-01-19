import { AccordionItem } from './AccordionItem';
import { StreamingAccordionItem } from './StreamingAccordionItem';
import { EmptyState } from './EmptyState';
import { GeneratePanel } from './GeneratePanel';
import type { AccordionItem as AccordionItemType } from '../../types/accordion';
import type { StreamingItem } from '../../types/streaming';

/**
 * Find the streaming item for the current video that is a NEW summary (not regenerating an existing one)
 */
function findNewStreamingForCurrentVideo(
  streamingItems: Map<string, StreamingItem>,
  currentVideoId: string | null,
  existingItems: AccordionItemType[]
): StreamingItem | undefined {
  return Array.from(streamingItems.values()).find(
    (s) => s.videoId === currentVideoId && !existingItems.some((item) => item.id === s.id)
  );
}

/**
 * Find streaming items for videos other than the current one (typically stopped/errored items)
 */
function findHistoryStreamingItems(
  streamingItems: Map<string, StreamingItem>,
  currentVideoId: string | null,
  existingItems: AccordionItemType[]
): [string, StreamingItem][] {
  return Array.from(streamingItems.entries()).filter(
    ([itemId, s]) => s.videoId !== currentVideoId && !existingItems.some((item) => item.id === itemId)
  );
}

/**
 * Check if an item is being replaced by a streaming item with a different prompt
 */
function isItemBeingReplaced(
  itemId: string,
  streamingItems: Map<string, StreamingItem>
): boolean {
  return Array.from(streamingItems.values()).some((s) => s.replaceItemId === itemId);
}

interface AccordionContainerProps {
  items: AccordionItemType[];
  currentVideoId: string | null;
  currentTabId: number | null;
  expandedIds: Set<string>;
  streamingItems: Map<string, StreamingItem>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (videoId: string, promptId: string, modelId: string, originalItemId: string, customPromptText?: string) => void;
  onRetry: (itemId: string) => void;
  onCancelStream: (itemId: string) => void;
  onGenerateForCurrentVideo: (promptId: string, modelId: string) => void;
  itemErrors: Map<string, string>;
  apiKey: string | null;
}

export function AccordionContainer({
  items,
  currentVideoId,
  currentTabId,
  expandedIds,
  streamingItems,
  onToggle,
  onDelete,
  onRegenerate,
  onRetry,
  onCancelStream,
  onGenerateForCurrentVideo,
  itemErrors,
  apiKey,
}: AccordionContainerProps): React.JSX.Element {
  // Categorize streaming items
  const currentVideoStreaming = findNewStreamingForCurrentVideo(streamingItems, currentVideoId, items);
  const historyStreaming = findHistoryStreamingItems(streamingItems, currentVideoId, items);

  // Determine if we should show the generate button
  const currentVideoHasItem = currentVideoId && items.some((item) => item.videoId === currentVideoId);
  const showGenerateButton = apiKey && currentVideoId && !currentVideoHasItem && !currentVideoStreaming;

  // Show empty state if no items and no streaming
  if (items.length === 0 && streamingItems.size === 0) {
    return (
      <div className="space-y-0">
        {apiKey && currentVideoId && (
          <GeneratePanel onGenerate={onGenerateForCurrentVideo} />
        )}
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Show generate panel when current video has no summary */}
      {showGenerateButton && (
        <GeneratePanel onGenerate={onGenerateForCurrentVideo} />
      )}

      {/* Show streaming item for current video at the top */}
      {currentVideoStreaming && (
        <StreamingAccordionItem
          item={currentVideoStreaming}
          isExpanded={expandedIds.has(currentVideoStreaming.id)}
          isCurrentVideo={true}
          onToggle={() => { onToggle(currentVideoStreaming.id); }}
          onCancel={() => { onCancelStream(currentVideoStreaming.id); }}
          onRetry={() => { onRetry(currentVideoStreaming.id); }}
          onDelete={() => { onDelete(currentVideoStreaming.id); }}
          onRegenerate={(promptId, modelId) => { onGenerateForCurrentVideo(promptId, modelId); }}
        />
      )}

      {/* Existing items - skip if there's a streaming version or being replaced */}
      {items.map((item) => {
        const isCurrentVideo = item.videoId === currentVideoId;

        // If this item is being replaced by another streaming item, hide it
        if (isItemBeingReplaced(item.id, streamingItems)) {
          return null;
        }

        // If this item is being regenerated (streaming), show StreamingAccordionItem instead
        const streamingVersion = streamingItems.get(item.id);
        if (streamingVersion) {
          return (
            <StreamingAccordionItem
              key={item.id}
              item={streamingVersion}
              isExpanded={expandedIds.has(item.id)}
              isCurrentVideo={isCurrentVideo}
              onToggle={() => { onToggle(item.id); }}
              onCancel={() => { onCancelStream(item.id); }}
              onRetry={() => { onRetry(item.id); }}
              onDelete={() => { onDelete(item.id); }}
              {...(isCurrentVideo && {
                onRegenerate: (promptId: string, modelId: string) => { onRegenerate(item.videoId, promptId, modelId, item.id); }
              })}
            />
          );
        }

        return (
          <AccordionItem
            key={item.id}
            item={item}
            isCurrentVideo={isCurrentVideo}
            currentTabId={currentTabId}
            isExpanded={expandedIds.has(item.id)}
            onToggle={() => { onToggle(item.id); }}
            onDelete={() => { onDelete(item.id); }}
            onRegenerate={(promptId, modelId, customPromptText) =>
              { onRegenerate(item.videoId, promptId, modelId, item.id, customPromptText); }
            }
            onRetry={() => { onRetry(item.id); }}
            error={itemErrors.get(item.id)}
          />
        );
      })}

      {/* Show streaming items for other videos (stopped/error) at the bottom */}
      {historyStreaming.map(([itemId, streaming]) => (
        <StreamingAccordionItem
          key={itemId}
          item={streaming}
          isExpanded={expandedIds.has(itemId)}
          isCurrentVideo={false}
          onToggle={() => { onToggle(itemId); }}
          onCancel={() => { onCancelStream(itemId); }}
          onRetry={() => { onRetry(itemId); }}
          onDelete={() => { onDelete(itemId); }}
        />
      ))}
    </div>
  );
}
