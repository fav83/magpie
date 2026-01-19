import { useState, useEffect } from 'react';
import { useChromeStorage } from '../../hooks/useChromeStorage';
import { STORAGE_KEYS, DEFAULT_CHAT_SYSTEM_PROMPT } from '../../config';
import { SettingsSection } from './SettingsSection';

export function ChatSettings(): React.JSX.Element {
  const [storedPrompt, setStoredPrompt] = useChromeStorage<string>(
    STORAGE_KEYS.CHAT_SYSTEM_PROMPT,
    DEFAULT_CHAT_SYSTEM_PROMPT
  );

  const [prompt, setPrompt] = useState(storedPrompt || DEFAULT_CHAT_SYSTEM_PROMPT);
  const [isSaved, setIsSaved] = useState(false);

  // Sync local state with storage
  useEffect(() => {
    setPrompt(storedPrompt || DEFAULT_CHAT_SYSTEM_PROMPT);
  }, [storedPrompt]);

  const handleSave = () => {
    void setStoredPrompt(prompt);
    setIsSaved(true);
    setTimeout(() => { setIsSaved(false); }, 2000);
  };

  const hasChanges = prompt !== (storedPrompt || DEFAULT_CHAT_SYSTEM_PROMPT);

  return (
    <SettingsSection title="Chat Settings">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Chat System Prompt</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          This prompt is used when chatting with video transcripts. The video summary and transcript
          will be automatically included in the context.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); }}
          rows={8}
          className="w-full px-3 py-2 text-xs font-mono leading-relaxed border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          placeholder="Enter the system prompt for chat..."
        />

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
          {isSaved && (
            <span className="text-sm text-green-600">Saved!</span>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
