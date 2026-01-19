import { useState, useCallback } from 'react';

interface UsePromptModelSelectionOptions {
  initialPromptId: string;
  initialModelId: string;
}

interface UsePromptModelSelectionReturn {
  selectedPromptId: string;
  selectedModelId: string;
  handlePromptChange: (promptId: string, modelId: string) => void;
  handleModelChange: (modelId: string) => void;
  hasChanges: (originalPromptId: string, originalModelId: string) => boolean;
}

/**
 * Hook for managing prompt and model selection state in accordion items
 */
export function usePromptModelSelection({
  initialPromptId,
  initialModelId,
}: UsePromptModelSelectionOptions): UsePromptModelSelectionReturn {
  const [selectedPromptId, setSelectedPromptId] = useState(initialPromptId);
  const [selectedModelId, setSelectedModelId] = useState(initialModelId);

  const handlePromptChange = useCallback((promptId: string, modelId: string) => {
    setSelectedPromptId(promptId);
    setSelectedModelId(modelId);
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
  }, []);

  const hasChanges = useCallback(
    (originalPromptId: string, originalModelId: string) => {
      return selectedPromptId !== originalPromptId || selectedModelId !== originalModelId;
    },
    [selectedPromptId, selectedModelId]
  );

  return {
    selectedPromptId,
    selectedModelId,
    handlePromptChange,
    handleModelChange,
    hasChanges,
  };
}
