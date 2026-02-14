import { useState, useEffect, useCallback } from 'react';
import type { ModelInfo } from '../services/modelService';
import { fetchModels, clearModelCache } from '../services/modelService';

interface UseModelsResult {
  models: ModelInfo[] | null;
  modelsError: boolean;
  retryModels: () => void;
}

export function useModels(apiKey: string | null): UseModelsResult {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = useState(false);

  const loadModels = useCallback(async () => {
    if (!apiKey) {
      setModelsError(true);
      return;
    }
    try {
      setModelsError(false);
      const result = await fetchModels(apiKey);
      setModels(result);
    } catch {
      setModelsError(true);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const retryModels = useCallback(() => {
    clearModelCache();
    void loadModels();
  }, [loadModels]);

  return { models, modelsError, retryModels };
}
