import { useState, useEffect } from 'react';
import type { Prompt } from '../../types/prompt';
import { getPrompts } from '../../utils/promptStorage';

interface PromptSelectorProps {
  value: string;
  onChange: (promptId: string, modelId: string) => void;
  disabled?: boolean;
}

export function PromptSelector({
  value,
  onChange,
  disabled = false,
}: PromptSelectorProps): React.JSX.Element {
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    void getPrompts().then(setPrompts);
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.prompts) {
        void getPrompts().then(setPrompts);
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const promptId = e.target.value;
    const selectedPrompt = prompts.find((p) => p.id === promptId);
    if (selectedPrompt) {
      onChange(promptId, selectedPrompt.model);
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className="text-[11px] px-1.5 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 min-w-0 truncate"
    >
      {prompts.map((prompt) => (
        <option key={prompt.id} value={prompt.id}>
          {prompt.name}
          {prompt.isDefault ? ' (Default)' : ''}
        </option>
      ))}
    </select>
  );
}
