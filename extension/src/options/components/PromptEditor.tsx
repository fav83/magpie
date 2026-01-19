import { useState, useEffect, useCallback, useRef } from 'react';
import type { Prompt } from '../../types/prompt';
import { validatePromptText, validatePromptName } from '../../utils/promptStorage';
import { ModelSelector } from './ModelSelector';
import { PromptActions } from './PromptActions';
import { DEFAULT_PROMPT } from '../../config';
import { DEFAULT_MODEL_ID } from '../../types/models';

interface PromptEditorProps {
  prompt: Prompt | null;
  isNew: boolean;
  apiKey: string | null;
  onSave: (updates: { name: string; text: string; model: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onSetDefault: () => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (isDirty: boolean) => void;
}

export function PromptEditor({
  prompt,
  isNew,
  apiKey,
  onSave,
  onDelete,
  onDuplicate,
  onSetDefault,
  onCancel,
  onDirtyChange,
}: PromptEditorProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [text, setText] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize form state when prompt changes
  useEffect(() => {
    if (isNew) {
      setName('');
      setText(DEFAULT_PROMPT);
      setModel(DEFAULT_MODEL_ID);
      // Auto-focus name input for new prompts
      setTimeout(() => { nameInputRef.current?.focus(); }, 0);
    } else if (prompt) {
      setName(prompt.name);
      setText(prompt.text);
      setModel(prompt.model);
    }
    setError('');
    setSaved(false);
  }, [prompt, isNew]);

  // Track dirty state
  useEffect(() => {
    if (isNew) {
      onDirtyChange(false);
      return;
    }
    if (!prompt) {
      onDirtyChange(false);
      return;
    }
    const isDirty =
      name !== prompt.name || text !== prompt.text || model !== prompt.model;
    onDirtyChange(isDirty);
  }, [name, text, model, prompt, isNew, onDirtyChange]);

  const handleSave = useCallback(async () => {
    setError('');
    setSaved(false);

    const nameValidation = validatePromptName(name);
    if (!nameValidation.valid) {
      setError(nameValidation.error);
      return;
    }

    const textValidation = validatePromptText(text);
    if (!textValidation.valid) {
      setError(textValidation.error);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name, text, model });
      setSaved(true);
      setTimeout(() => { setSaved(false); }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [name, text, model, onSave]);

  const handleModelChange = useCallback(
    async (modelId: string) => {
      setModel(modelId);
      // For system prompt, save immediately since text/name can't be edited
      if (prompt?.isSystem) {
        setIsSaving(true);
        try {
          await onSave({ name: prompt.name, text: prompt.text, model: modelId });
          setSaved(true);
          setTimeout(() => { setSaved(false); }, 2000);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save model');
        } finally {
          setIsSaving(false);
        }
      }
    },
    [prompt, onSave]
  );

  // Check if there are unsaved changes
  const hasChanges = isNew
    ? name.trim().length > 0 // For new prompts, just need a name to be considered "changed"
    : prompt
      ? name !== prompt.name || text !== prompt.text || model !== prompt.model
      : false;

  // Validation check for enabling save button
  const isValid =
    name.trim().length > 0 && text.includes('{{transcript}}') && model.length > 0;

  // Can only save if valid AND has changes
  const canSave = isValid && hasChanges;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSave) {
        e.preventDefault();
        void handleSave();
      }
    },
    [handleSave, canSave]
  );

  if (!prompt && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a prompt to edit
      </div>
    );
  }

  const isSystem = prompt?.isSystem ?? false;
  const isDefault = prompt?.isDefault ?? false;

  return (
    <div className="flex flex-col h-full p-4" onKeyDown={handleKeyDown}>
      {/* Name field */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        {isSystem ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              disabled
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
            />
            <span className="text-gray-400" title="System prompt name cannot be changed">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        ) : (
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); }}
            placeholder="My Custom Prompt"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}
      </div>

      {/* Model selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <ModelSelector
          value={model}
          onChange={(modelId) => { void handleModelChange(modelId); }}
          apiKey={apiKey}
        />
      </div>

      {/* Prompt text */}
      <div className="flex-1 flex flex-col min-h-0 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prompt
        </label>
        {isSystem ? (
          <>
            <div className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-xs text-gray-600 font-mono whitespace-pre-wrap overflow-auto leading-relaxed">
              {text}
            </div>
            <p className="text-xs text-gray-500 mt-1 italic">
              System prompt text cannot be edited
            </p>
          </>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); }}
              placeholder="Enter your prompt..."
              className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs leading-relaxed resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">{'{{transcript}}'}</code>{' '}
              as a placeholder for the video transcript.
            </p>
          </>
        )}
      </div>

      {/* Status messages */}
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {saved && <p className="text-green-600 text-sm mb-2">Saved successfully!</p>}

      {/* Actions */}
      <PromptActions
        isNew={isNew}
        isSystem={isSystem}
        isDefault={isDefault}
        canSave={canSave}
        isSaving={isSaving}
        onSave={() => { void handleSave(); }}
        onDuplicate={() => { void onDuplicate(); }}
        onDelete={() => { void onDelete(); }}
        onSetDefault={() => { void onSetDefault(); }}
        onCancel={onCancel}
      />
    </div>
  );
}
