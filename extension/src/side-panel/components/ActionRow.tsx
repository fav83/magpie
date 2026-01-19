import { PromptSelector } from './PromptSelector';
import { CompactModelSelector } from './CompactModelSelector';
import { CopyButton } from './CopyButton';
import { PromptEditorSection } from './PromptEditorSection';
import { RefreshIcon } from './Icons';
import { Tooltip } from './Tooltip';

interface ActionRowProps {
  selectedPromptId: string;
  selectedModelId: string;
  onPromptChange: (promptId: string, modelId: string) => void;
  onModelChange: (modelId: string) => void;
  onRegenerate: () => void;
  onRegenerateWithCustomPrompt: (customPromptText: string) => void;
  onRegenerateWithNewPrompt: (promptId: string) => void;
  content: string;
  videoTitle: string;
  videoUrl: string;
  apiKey: string | null;
  showSelectors: boolean;
  hasError?: boolean;
  customPromptText: string | undefined;
}

export function ActionRow({
  selectedPromptId,
  selectedModelId,
  onPromptChange,
  onModelChange,
  onRegenerate,
  onRegenerateWithCustomPrompt,
  onRegenerateWithNewPrompt,
  content,
  videoTitle,
  videoUrl,
  apiKey,
  showSelectors,
  hasError = false,
  customPromptText,
}: ActionRowProps): React.JSX.Element | null {
  // For current video: show prompt selector, model selector, copy, regenerate
  // But hide selectors if there's no API key (only show error message)
  if (showSelectors) {
    // If no API key, don't show selectors at all
    if (!apiKey) {
      return null;
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <PromptSelector
            value={selectedPromptId}
            onChange={onPromptChange}
          />
          <CompactModelSelector
            value={selectedModelId}
            onChange={onModelChange}
            apiKey={apiKey}
          />
          {!hasError && (
            <>
              <CopyButton content={content} videoTitle={videoTitle} videoUrl={videoUrl} />
              <Tooltip content="Regenerate">
                <button
                  type="button"
                  onClick={onRegenerate}
                  aria-label="Regenerate"
                  className="p-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                >
                  <RefreshIcon className="w-3.5 h-3.5 text-gray-700" />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        <PromptEditorSection
          promptId={selectedPromptId}
          customPromptText={customPromptText}
          onApplyCustomPrompt={onRegenerateWithCustomPrompt}
          onRegenerateWithPrompt={onRegenerateWithNewPrompt}
        />
      </div>
    );
  }

  // For history items: show model name and copy button aligned right
  return (
    <div className="flex items-center justify-end gap-1.5 text-xs text-gray-400">
      <span>{selectedModelId.split('/').pop()}</span>
      {!hasError && <CopyButton content={content} videoTitle={videoTitle} videoUrl={videoUrl} />}
    </div>
  );
}
