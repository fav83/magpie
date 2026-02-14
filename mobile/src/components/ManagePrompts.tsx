import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Prompt } from '../types/prompt';
import {
  getPrompts,
  addPrompt,
  updatePrompt,
  deletePrompt,
  duplicatePrompt,
  setDefaultPromptId,
  resetBuiltInPrompt,
} from '../services/promptStorage';
import { PromptAccordionItem } from './PromptAccordionItem';
import { ConfirmDialog } from './ConfirmDialog';
import { PromptActionsProvider } from './PromptActionsContext';
import { useFavoriteModels } from '../hooks/useFavoriteModels';
import { useModels } from '../hooks/useModels';
import { BackButton } from './ui';

interface ManagePromptsProps {
  onBack: () => void;
  apiKey: string | null;
}

type DialogState =
  | { type: 'none' }
  | { type: 'delete'; promptId: string; promptName: string }
  | { type: 'reset'; promptId: string; promptName: string };

export function ManagePrompts({ onBack, apiKey }: ManagePromptsProps): React.JSX.Element {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const { favoriteIds } = useFavoriteModels();
  const { models, modelsError, retryModels: handleRetryModels } = useModels(apiKey);

  const loadPrompts = useCallback(async () => {
    const loaded = await getPrompts();
    setPrompts(loaded);
  }, []);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const handleToggle = (id: string) => {
    setAutoFocusId(null);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSave = useCallback(async (id: string, updates: { name: string; text: string; model: string }) => {
    await updatePrompt(id, updates);
    await loadPrompts();
  }, [loadPrompts]);

  const handleSetDefault = useCallback(async (id: string) => {
    await setDefaultPromptId(id);
    await loadPrompts();
  }, [loadPrompts]);

  const handleDuplicate = useCallback(async (id: string) => {
    const newPrompt = await duplicatePrompt(id);
    await loadPrompts();
    setExpandedId(newPrompt.id);
    setAutoFocusId(newPrompt.id);
  }, [loadPrompts]);

  const handleDeleteRequest = useCallback((id: string) => {
    setPrompts((current) => {
      const prompt = current.find((p) => p.id === id);
      if (prompt) {
        setDialog({ type: 'delete', promptId: id, promptName: prompt.name });
      }
      return current;
    });
  }, []);

  const handleDeleteConfirm = async () => {
    if (dialog.type !== 'delete') return;
    await deletePrompt(dialog.promptId);
    if (expandedId === dialog.promptId) {
      setExpandedId(null);
    }
    setDialog({ type: 'none' });
    await loadPrompts();
  };

  const handleResetRequest = useCallback((id: string) => {
    setPrompts((current) => {
      const prompt = current.find((p) => p.id === id);
      if (prompt) {
        setDialog({ type: 'reset', promptId: id, promptName: prompt.name });
      }
      return current;
    });
  }, []);

  const handleResetConfirm = async () => {
    if (dialog.type !== 'reset') return;
    await resetBuiltInPrompt(dialog.promptId);
    setDialog({ type: 'none' });
    await loadPrompts();
  };

  const handleAdd = async () => {
    const newPrompt = await addPrompt('', '{{transcript}}');
    await loadPrompts();
    setExpandedId(newPrompt.id);
    setAutoFocusId(newPrompt.id);
  };

  const actions = useMemo(() => ({
    models,
    modelsError,
    favoriteIds,
    onRetryModels: handleRetryModels,
    onSave: handleSave,
    onSetDefault: (id: string) => void handleSetDefault(id),
    onDuplicate: (id: string) => void handleDuplicate(id),
    onDelete: handleDeleteRequest,
    onReset: handleResetRequest,
  }), [models, modelsError, favoriteIds, handleRetryModels, handleSave, handleSetDefault, handleDuplicate, handleDeleteRequest, handleResetRequest]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <BackButton onClick={onBack} />
          <h1 className="text-lg font-semibold text-gray-800">Manage Prompts</h1>
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          + Add
        </button>
      </header>

      {/* Prompt List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        <PromptActionsProvider value={actions}>
          {prompts.map((prompt) => (
            <PromptAccordionItem
              key={prompt.id}
              prompt={prompt}
              isExpanded={expandedId === prompt.id}
              onToggle={() => handleToggle(prompt.id)}
              autoFocusName={autoFocusId === prompt.id}
            />
          ))}
        </PromptActionsProvider>
      </div>

      {/* Confirmation Dialogs */}
      {dialog.type === 'delete' && (
        <ConfirmDialog
          title="Delete Prompt?"
          message={`Are you sure you want to delete "${dialog.promptName}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmDestructive
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}

      {dialog.type === 'reset' && (
        <ConfirmDialog
          title="Reset Prompt?"
          message={`This will restore the original name and text for "${dialog.promptName}". Your changes will be lost.`}
          confirmLabel="Reset"
          confirmDestructive
          onConfirm={() => void handleResetConfirm()}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
    </div>
  );
}
