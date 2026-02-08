import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Prompt } from '../types/prompt';
import type { ModelInfo } from '../services/modelService';
import { fetchModels, clearModelCache } from '../services/modelService';
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
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

  const loadPrompts = useCallback(async () => {
    const loaded = await getPrompts();
    setPrompts(loaded);
  }, []);

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
    void loadPrompts();
    void loadModels();
  }, [loadPrompts, loadModels]);

  const handleRetryModels = () => {
    clearModelCache();
    void loadModels();
  };

  const handleToggle = (id: string) => {
    setAutoFocusId(null);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSave = async (id: string, updates: { name: string; text: string; model: string }) => {
    await updatePrompt(id, updates);
    await loadPrompts();
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultPromptId(id);
    await loadPrompts();
  };

  const handleDuplicate = async (id: string) => {
    const newPrompt = await duplicatePrompt(id);
    await loadPrompts();
    setExpandedId(newPrompt.id);
    setAutoFocusId(newPrompt.id);
  };

  const handleDeleteRequest = (id: string) => {
    const prompt = prompts.find((p) => p.id === id);
    if (prompt) {
      setDialog({ type: 'delete', promptId: id, promptName: prompt.name });
    }
  };

  const handleDeleteConfirm = async () => {
    if (dialog.type !== 'delete') return;
    await deletePrompt(dialog.promptId);
    if (expandedId === dialog.promptId) {
      setExpandedId(null);
    }
    setDialog({ type: 'none' });
    await loadPrompts();
  };

  const handleResetRequest = (id: string) => {
    const prompt = prompts.find((p) => p.id === id);
    if (prompt) {
      setDialog({ type: 'reset', promptId: id, promptName: prompt.name });
    }
  };

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
    onRetryModels: handleRetryModels,
    onSave: handleSave,
    onSetDefault: (id: string) => void handleSetDefault(id),
    onDuplicate: (id: string) => void handleDuplicate(id),
    onDelete: handleDeleteRequest,
    onReset: handleResetRequest,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [models, modelsError, prompts]);

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
