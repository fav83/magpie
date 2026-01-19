import { useState } from 'react';
import { STORAGE_KEYS, DEFAULT_CHAT_SYSTEM_PROMPT, FONT_SIZE } from '../../config';
import { SYSTEM_PROMPT_ID } from '../../types/prompt';
import { ConfirmationModal } from './ConfirmationModal';

async function resetToDefaults(): Promise<void> {
  // Reset preferences to defaults (preserving API key, summaries, and chats)
  await chrome.storage.local.set({
    // Font size
    [STORAGE_KEYS.FONT_SIZE]: FONT_SIZE.DEFAULT,

    // Prompts - clear all and reset version to trigger re-seeding
    [STORAGE_KEYS.PROMPTS]: [],
    [STORAGE_KEYS.DEFAULT_PROMPT_ID]: SYSTEM_PROMPT_ID,
    [STORAGE_KEYS.DEFAULT_PROMPTS_VERSION]: 0,

    // Chat system prompt
    [STORAGE_KEYS.CHAT_SYSTEM_PROMPT]: DEFAULT_CHAT_SYSTEM_PROMPT,

    // Model preferences
    [STORAGE_KEYS.PREFERRED_MODELS]: [],
    [STORAGE_KEYS.SHOW_FREE_ONLY_OPTIONS]: false,
    [STORAGE_KEYS.SHOW_FREE_ONLY_SIDEBAR]: false,
  });
}

export function DangerZoneSection(): React.JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleReset = async (): Promise<void> => {
    await resetToDefaults();
    setIsModalOpen(false);
    // Full page reload to ensure all components re-initialize
    window.location.reload();
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-red-200 p-5 shadow-sm">
        <h3 className="text-sm font-medium text-red-700 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-600 mb-4">
          Reset all settings to their default values. This will delete all custom prompts and restore
          the original 10 built-in prompts. Your API key, saved summaries, chat history, and keyboard
          shortcut will be preserved.
        </p>
        <button
          type="button"
          onClick={() => { setIsModalOpen(true); }}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        title="Reset to Defaults?"
        message="This will reset all settings to their default values and delete all custom prompts. Your API key, saved summaries, chat history, and keyboard shortcut will be preserved. This action cannot be undone."
        confirmLabel="Reset to Defaults"
        onConfirm={() => { void handleReset(); }}
        onCancel={() => { setIsModalOpen(false); }}
      />
    </>
  );
}
