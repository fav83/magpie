import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '../../types/prompt';
import {
  getPrompts,
  addPrompt,
  updatePrompt,
  deletePrompt,
  duplicatePrompt,
  setDefaultPromptId,
} from '../../utils/promptStorage';
import { STORAGE_KEYS } from '../../config';
import { useChromeStorage, useStorageListener } from '../../hooks/useChromeStorage';
import { PromptListPanel } from './PromptListPanel';
import { PromptEditor } from './PromptEditor';

export function PromptsSection(): React.JSX.Element {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [dirtyPromptId, setDirtyPromptId] = useState<string | null>(null);
  const [apiKey] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);

  const loadPrompts = useCallback(async () => {
    const loaded = await getPrompts();
    setPrompts(loaded);
    return loaded;
  }, []);

  // Initial load and auto-select first prompt
  useEffect(() => {
    void loadPrompts().then((loaded) => {
      const firstPrompt = loaded[0];
      if (firstPrompt && selectedId === null && !isCreatingNew) {
        setSelectedId(firstPrompt.id);
      }
    });
  }, [loadPrompts, selectedId, isCreatingNew]);

  // Listen for storage changes
  useStorageListener(['prompts', 'defaultPromptId'], () => {
    void loadPrompts();
  });

  const selectedPrompt = prompts.find((p) => p.id === selectedId) ?? null;

  const handleSelect = useCallback((id: string) => {
    setIsCreatingNew(false);
    setSelectedId(id);
    setDirtyPromptId(null);
  }, []);

  const handleAddNew = useCallback(() => {
    setIsCreatingNew(true);
    setSelectedId(null);
    setDirtyPromptId(null);
  }, []);

  const handleSaveNew = useCallback(
    async (updates: { name: string; text: string; model: string }) => {
      const newPrompt = await addPrompt(updates.name, updates.text, updates.model);
      await loadPrompts();
      setIsCreatingNew(false);
      // Select the newly created prompt
      setSelectedId(newPrompt.id);
    },
    [loadPrompts]
  );

  const handleSaveExisting = useCallback(
    async (updates: { name: string; text: string; model: string }) => {
      if (!selectedId) return;
      await updatePrompt(selectedId, updates);
      await loadPrompts();
      setDirtyPromptId(null);
    },
    [selectedId, loadPrompts]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;

    const currentIndex = prompts.findIndex((p) => p.id === selectedId);
    await deletePrompt(selectedId);
    const loaded = await loadPrompts();

    // Select next prompt (or previous if last was deleted)
    const nextIndex = Math.min(currentIndex, loaded.length - 1);
    const nextPrompt = loaded[nextIndex];
    if (nextPrompt) {
      setSelectedId(nextPrompt.id);
    } else {
      setSelectedId(null);
    }
    setDirtyPromptId(null);
  }, [selectedId, prompts, loadPrompts]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedId) return;
    const duplicated = await duplicatePrompt(selectedId);
    await loadPrompts();
    // Select the duplicated prompt
    setSelectedId(duplicated.id);
  }, [selectedId, loadPrompts]);

  const handleSetDefault = useCallback(async () => {
    if (!selectedId) return;
    await setDefaultPromptId(selectedId);
    await loadPrompts();
  }, [selectedId, loadPrompts]);

  const handleCancel = useCallback(() => {
    setIsCreatingNew(false);
    // Select first prompt if available
    const firstPrompt = prompts[0];
    if (firstPrompt) {
      setSelectedId(firstPrompt.id);
    }
  }, [prompts]);

  const handleDirtyChange = useCallback(
    (isDirty: boolean) => {
      if (isDirty && selectedId) {
        setDirtyPromptId(selectedId);
      } else {
        setDirtyPromptId(null);
      }
    },
    [selectedId]
  );

  return (
    <div className="flex h-full border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Left panel - Prompt list (30%) */}
      <div className="w-[30%] min-w-[180px]">
        <PromptListPanel
          prompts={prompts}
          selectedId={selectedId}
          dirtyPromptId={dirtyPromptId}
          isCreatingNew={isCreatingNew}
          onSelect={handleSelect}
          onAddNew={handleAddNew}
        />
      </div>

      {/* Right panel - Editor (70%) */}
      <div className="flex-1 min-w-0">
        <PromptEditor
          prompt={selectedPrompt}
          isNew={isCreatingNew}
          apiKey={apiKey}
          onSave={isCreatingNew ? handleSaveNew : handleSaveExisting}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onSetDefault={handleSetDefault}
          onCancel={handleCancel}
          onDirtyChange={handleDirtyChange}
        />
      </div>
    </div>
  );
}
