import { useState, useRef, useCallback } from 'react';
import { getPrompts, getDefaultPromptId } from '../services/promptStorage';
import type { Prompt } from '../types/prompt';

export function usePromptManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const selectedPromptIdRef = useRef(selectedPromptId);
  selectedPromptIdRef.current = selectedPromptId;

  const loadPromptData = useCallback(async () => {
    const loaded = await getPrompts();
    setPrompts(loaded);
    const currentId = selectedPromptIdRef.current;
    if (!currentId || !loaded.some((p) => p.id === currentId)) {
      const defaultId = await getDefaultPromptId();
      setSelectedPromptId(defaultId);
    }
  }, []);

  return { prompts, selectedPromptId, setSelectedPromptId, loadPromptData };
}
