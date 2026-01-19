import { useState, useEffect } from 'react';
import { PromptSelector } from './PromptSelector';
import { CompactModelSelector } from './CompactModelSelector';
import { useChromeStorage } from '../../hooks/useChromeStorage';
import { STORAGE_KEYS } from '../../config';
import { getDefaultPromptAndModel } from '../../utils/promptStorage';

interface GeneratePanelProps {
  onGenerate: (promptId: string, modelId: string) => void;
}

export function GeneratePanel({ onGenerate }: GeneratePanelProps): React.JSX.Element {
  const [apiKey] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load default prompt and model on mount
  useEffect(() => {
    void (async () => {
      const { promptId, modelId } = await getDefaultPromptAndModel();
      setSelectedPromptId(promptId);
      setSelectedModelId(modelId);
      setIsInitialized(true);
    })();
  }, []);

  const handlePromptChange = (promptId: string, modelId: string) => {
    setSelectedPromptId(promptId);
    setSelectedModelId(modelId);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  const handleGenerate = () => {
    if (selectedPromptId && selectedModelId) {
      onGenerate(selectedPromptId, selectedModelId);
    }
  };

  if (!isInitialized) {
    return <div className="bg-gray-100 px-2 py-1.5" />;
  }

  return (
    <div className="bg-gray-100 px-2 py-1.5 space-y-2">
      <div className="flex items-center gap-1.5">
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
      <button
        onClick={handleGenerate}
        className="w-full px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
      >
        Generate Summary
      </button>
    </div>
  );
}
