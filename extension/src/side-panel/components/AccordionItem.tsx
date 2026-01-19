import type { AccordionItem as AccordionItemType } from '../../types/accordion';
import { useChromeStorage } from '../../hooks/useChromeStorage';
import { useFontSize } from '../../hooks/useFontSize';
import { usePromptModelSelection } from '../hooks/usePromptModelSelection';
import { STORAGE_KEYS } from '../../config';
import { AccordionHeader } from './AccordionHeader';
import { AccordionContent } from './AccordionContent';

interface AccordionItemProps {
  item: AccordionItemType;
  isCurrentVideo: boolean;
  currentTabId: number | null;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (() => void) | undefined;
  onRegenerate: (promptId: string, modelId: string, customPromptText?: string) => void;
  onRetry: (() => void) | undefined;
  error: string | undefined;
}

export function AccordionItem({
  item,
  isCurrentVideo,
  currentTabId,
  isExpanded,
  onToggle,
  onDelete,
  onRegenerate,
  onRetry,
  error,
}: AccordionItemProps): React.JSX.Element {
  const [apiKey] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);
  const fontSize = useFontSize();
  const {
    selectedPromptId,
    selectedModelId,
    handlePromptChange: onPromptChange,
    handleModelChange: onModelChange,
  } = usePromptModelSelection({
    initialPromptId: item.promptId,
    initialModelId: item.modelId,
  });

  const handlePromptChange = (promptId: string, modelId: string) => {
    onPromptChange(promptId, modelId);
    onRegenerate(promptId, modelId);
  };

  const handleModelChange = (modelId: string) => {
    onModelChange(modelId);
    onRegenerate(item.promptId, modelId);
  };

  const handleRegenerate = () => {
    onRegenerate(selectedPromptId, selectedModelId);
  };

  const handleRegenerateWithCustomPrompt = (customPromptText: string) => {
    onRegenerate(selectedPromptId, selectedModelId, customPromptText);
  };

  const handleRegenerateWithNewPrompt = (promptId: string) => {
    // When a new prompt is created/updated, regenerate with that prompt
    onPromptChange(promptId, selectedModelId);
    onRegenerate(promptId, selectedModelId);
  };

  const containerClasses = isCurrentVideo
    ? 'bg-gray-100'
    : 'border-b border-gray-100';

  return (
    <div className={containerClasses}>
      <AccordionHeader
        title={item.videoTitle}
        promptName={item.promptName}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actionButton={onDelete ? { type: 'delete', onClick: onDelete, title: 'Delete summary' } : undefined}
        fontSize={fontSize}
        isEdited={!!item.customPromptText}
      />

      {isExpanded && (
        <AccordionContent
          item={item}
          isCurrentVideo={isCurrentVideo}
          currentTabId={currentTabId}
          fontSize={fontSize}
          apiKey={apiKey}
          selectedPromptId={selectedPromptId}
          selectedModelId={selectedModelId}
          onPromptChange={handlePromptChange}
          onModelChange={handleModelChange}
          onRegenerate={handleRegenerate}
          onRegenerateWithCustomPrompt={handleRegenerateWithCustomPrompt}
          onRegenerateWithNewPrompt={handleRegenerateWithNewPrompt}
          error={error}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}
