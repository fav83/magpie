import type { AccordionItem as AccordionItemType } from '../../types/accordion';
import { VideoUrlButton } from './VideoUrlButton';
import { ActionRow } from './ActionRow';
import { InlineError } from './InlineError';
import { SummaryContent } from './SummaryContent';
import { ChatSection } from './chat';
import { formatTimestamp } from '../../utils/formatTimestamp';

interface AccordionContentProps {
  item: AccordionItemType;
  isCurrentVideo: boolean;
  currentTabId: number | null;
  fontSize: number;
  apiKey: string | null;
  selectedPromptId: string;
  selectedModelId: string;
  onPromptChange: (promptId: string, modelId: string) => void;
  onModelChange: (modelId: string) => void;
  onRegenerate: () => void;
  onRegenerateWithCustomPrompt: (customPromptText: string) => void;
  onRegenerateWithNewPrompt: (promptId: string) => void;
  error: string | undefined;
  onRetry: (() => void) | undefined;
}

export function AccordionContent({
  item,
  isCurrentVideo,
  currentTabId,
  fontSize,
  apiKey,
  selectedPromptId,
  selectedModelId,
  onPromptChange,
  onModelChange,
  onRegenerate,
  onRegenerateWithCustomPrompt,
  onRegenerateWithNewPrompt,
  error,
  onRetry,
}: AccordionContentProps): React.JSX.Element {
  return (
    <div className="px-4 pb-3 space-y-2">
      <div className="flex items-center gap-2">
        <VideoUrlButton url={item.videoUrl} fontSize={fontSize} />
        <span className="text-xs text-gray-400 flex-shrink-0">
          {formatTimestamp(item.timestamp)}
        </span>
      </div>

      <ActionRow
        selectedPromptId={selectedPromptId}
        selectedModelId={selectedModelId}
        onPromptChange={onPromptChange}
        onModelChange={onModelChange}
        onRegenerate={onRegenerate}
        onRegenerateWithCustomPrompt={onRegenerateWithCustomPrompt}
        onRegenerateWithNewPrompt={onRegenerateWithNewPrompt}
        content={item.summary}
        videoTitle={item.videoTitle}
        videoUrl={item.videoUrl}
        apiKey={apiKey}
        showSelectors={isCurrentVideo}
        hasError={!!error}
        customPromptText={item.customPromptText}
      />

      {error && <InlineError message={error} onRetry={onRetry} />}

      {!error && <SummaryContent content={item.summary} fontSize={fontSize} />}

      {!error && isCurrentVideo && currentTabId !== null && (
        <ChatSection
          videoId={item.videoId}
          tabId={currentTabId}
          summary={item.summary}
          modelId={selectedModelId}
        />
      )}
      {!error && !isCurrentVideo && (
        <ChatSection
          videoId={item.videoId}
          readonly
        />
      )}
    </div>
  );
}
