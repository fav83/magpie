import { useRef, useCallback, useEffect } from 'react';
import type { Prompt } from '../../types/prompt';
import { PromptListItem } from './PromptListItem';

interface PromptListPanelProps {
  prompts: Prompt[];
  selectedId: string | null;
  dirtyPromptId: string | null;
  isCreatingNew: boolean;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}

export function PromptListPanel({
  prompts,
  selectedId,
  dirtyPromptId,
  isCreatingNew,
  onSelect,
  onAddNew,
}: PromptListPanelProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (prompts.length === 0) return;

      const currentIndex = prompts.findIndex((p) => p.id === selectedId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < prompts.length - 1 ? currentIndex + 1 : 0;
        const nextPrompt = prompts[nextIndex];
        if (nextPrompt) {
          onSelect(nextPrompt.id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : prompts.length - 1;
        const prevPrompt = prompts[prevIndex];
        if (prevPrompt) {
          onSelect(prevPrompt.id);
        }
      }
    },
    [prompts, selectedId, onSelect]
  );

  // Auto-focus list when component mounts
  useEffect(() => {
    if (listRef.current && !isCreatingNew) {
      listRef.current.focus();
    }
  }, [isCreatingNew]);

  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      {/* Header with Add button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">Prompts</h2>
        <button
          type="button"
          onClick={onAddNew}
          disabled={isCreatingNew}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add new prompt"
        >
          + Add
        </button>
      </div>

      {/* Scrollable list */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Prompts"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-y-auto focus:outline-none"
      >
        {/* New prompt placeholder */}
        {isCreatingNew && (
          <div
            className="px-3 py-2 bg-blue-50 border-l-2 border-l-blue-500 border-b border-blue-100"
          >
            <span className="font-medium text-sm text-blue-700 italic">
              New Prompt
            </span>
          </div>
        )}

        {/* Existing prompts */}
        {prompts.map((prompt) => (
          <PromptListItem
            key={prompt.id}
            prompt={prompt}
            isSelected={!isCreatingNew && prompt.id === selectedId}
            isDirty={prompt.id === dirtyPromptId}
            onClick={() => { onSelect(prompt.id); }}
          />
        ))}

        {prompts.length === 0 && !isCreatingNew && (
          <p className="text-gray-500 text-sm text-center py-4">No prompts</p>
        )}
      </div>
    </div>
  );
}
