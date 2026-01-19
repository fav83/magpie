import type { StreamingItem } from '../../types/streaming';
import { useFontSize } from '../../hooks/useFontSize';
import { useChromeStorage } from '../../hooks/useChromeStorage';
import { usePromptModelSelection } from '../hooks/usePromptModelSelection';
import { STORAGE_KEYS } from '../../config';
import { AccordionHeader } from './AccordionHeader';
import { VideoUrlButton } from './VideoUrlButton';
import { CopyButton } from './CopyButton';
import { StreamingContent } from './StreamingContent';
import { InlineError } from './InlineError';
import { PromptSelector } from './PromptSelector';
import { CompactModelSelector } from './CompactModelSelector';

interface StreamingAccordionItemProps {
  item: StreamingItem;
  isExpanded: boolean;
  isCurrentVideo?: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onRegenerate?: (promptId: string, modelId: string) => void;
}

export function StreamingAccordionItem({
  item,
  isExpanded,
  isCurrentVideo = true,
  onToggle,
  onCancel,
  onRetry,
  onDelete,
  onRegenerate,
}: StreamingAccordionItemProps): React.JSX.Element {
  const fontSize = useFontSize();
  const [apiKey] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);
  const {
    selectedPromptId,
    selectedModelId,
    handlePromptChange,
    handleModelChange,
    hasChanges,
  } = usePromptModelSelection({
    initialPromptId: item.promptId,
    initialModelId: item.modelId,
  });
  const isStreaming = item.status === 'streaming';
  const hasError = item.status === 'error';
  const isStopped = item.status === 'stopped';

  const handleRetryWithSettings = () => {
    if (onRegenerate && hasChanges(item.promptId, item.modelId)) {
      onRegenerate(selectedPromptId, selectedModelId);
    } else {
      onRetry();
    }
  };

  const containerClasses = isCurrentVideo
    ? 'bg-gray-100'
    : 'border-b border-gray-100';

  const getActionButton = () => {
    if (isStreaming) {
      return { type: 'cancel' as const, onClick: onCancel, title: 'Cancel generation' };
    }
    if (hasError || isStopped) {
      return { type: 'delete' as const, onClick: onDelete, title: 'Delete' };
    }
    return undefined;
  };

  return (
    <div className={containerClasses}>
      <AccordionHeader
        title={item.videoTitle}
        promptName={item.promptName}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actionButton={getActionButton()}
        fontSize={fontSize}
      />

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          <VideoUrlButton url={item.videoUrl} fontSize={fontSize} />

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Model: {item.modelId.split('/').pop()}</span>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <span className="text-indigo-600">Generating...</span>
              )}
              {isStopped && (
                <span className="text-amber-600">Stopped</span>
              )}
              {item.content && (
                <CopyButton
                  content={item.fullContent || item.content}
                  videoTitle={item.videoTitle}
                  videoUrl={item.videoUrl}
                />
              )}
            </div>
          </div>

          {(hasError || isStopped) && item.error && (
            <>
              {isCurrentVideo && onRegenerate && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <PromptSelector
                    value={selectedPromptId}
                    onChange={handlePromptChange}
                  />
                  <CompactModelSelector
                    value={selectedModelId}
                    onChange={handleModelChange}
                    apiKey={apiKey}
                  />
                </div>
              )}
              <InlineError
                message={item.error}
                onRetry={isCurrentVideo ? handleRetryWithSettings : undefined}
                isStopped={isStopped}
              />
            </>
          )}

          <StreamingContent content={item.content} isStreaming={isStreaming && !hasError && !isStopped} />
        </div>
      )}
    </div>
  );
}
