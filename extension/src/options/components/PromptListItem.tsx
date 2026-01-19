import type { Prompt } from '../../types/prompt';

interface PromptListItemProps {
  prompt: Prompt;
  isSelected: boolean;
  isDirty: boolean;
  onClick: () => void;
}

export function PromptListItem({
  prompt,
  isSelected,
  isDirty,
  onClick,
}: PromptListItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
      className={`w-full px-3 py-2 text-left transition-colors ${
        isSelected
          ? 'bg-blue-50 border-l-2 border-l-blue-500'
          : 'hover:bg-gray-50 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-sm text-gray-900 truncate flex-1">
          {prompt.name}
        </span>
        {isDirty && (
          <span
            className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0"
            title="Unsaved changes"
          />
        )}
      </div>
      {(prompt.isDefault || prompt.isSystem) && (
        <div className="flex gap-1 mt-1">
          {prompt.isDefault && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
              Default
            </span>
          )}
          {prompt.isSystem && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
              System
            </span>
          )}
        </div>
      )}
    </button>
  );
}
