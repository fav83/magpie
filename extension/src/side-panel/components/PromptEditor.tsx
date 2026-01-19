import type { EditorMode } from '../hooks/usePromptEditor';

interface PromptEditorProps {
  mode: EditorMode;
  promptText: string;
  newPromptName: string;
  isValid: boolean;
  validationError: string | undefined;
  operationError: string | undefined;
  isSystemPrompt: boolean;
  isLoading: boolean;
  onPromptTextChange: (text: string) => void;
  onNewPromptNameChange: (name: string) => void;
  onApply: () => void;
  onUpdate: () => void;
  onSaveNew: () => void;
  onConfirmSaveNew: () => void;
  onBackFromSaveNew: () => void;
  onCancel: () => void;
}

interface ActionButton {
  label: string;
  onClick: () => void;
  disabled: boolean;
  primary: boolean;
  title?: string | undefined;
}

interface ModeConfig {
  showNameInput: boolean;
  actions: ActionButton[];
}

function getModeConfig(
  mode: EditorMode,
  isValid: boolean,
  isSystemPrompt: boolean,
  newPromptName: string,
  handlers: {
    onApply: () => void;
    onUpdate: () => void;
    onSaveNew: () => void;
    onConfirmSaveNew: () => void;
    onBackFromSaveNew: () => void;
    onCancel: () => void;
  }
): ModeConfig | null {
  switch (mode) {
    case 'closed':
      return null;

    case 'editing':
      return {
        showNameInput: false,
        actions: [
          { label: 'Apply', onClick: handlers.onApply, disabled: !isValid, primary: true },
          {
            label: 'Update',
            onClick: handlers.onUpdate,
            disabled: !isValid || isSystemPrompt,
            primary: false,
            title: isSystemPrompt ? 'System prompts cannot be modified' : undefined
          },
          { label: 'Save new', onClick: handlers.onSaveNew, disabled: !isValid, primary: false },
          { label: 'Cancel', onClick: handlers.onCancel, disabled: false, primary: false },
        ],
      };

    case 'saving-new':
      return {
        showNameInput: true,
        actions: [
          { label: 'Confirm', onClick: handlers.onConfirmSaveNew, disabled: !isValid || !newPromptName.trim(), primary: true },
          { label: 'Back', onClick: handlers.onBackFromSaveNew, disabled: false, primary: false },
        ],
      };

    default: {
      // Exhaustive check - TypeScript will error if a case is missing
      const _exhaustiveCheck: never = mode;
      return _exhaustiveCheck;
    }
  }
}

function ActionButtons({ actions }: { actions: ActionButton[] }): React.JSX.Element {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.title}
          className={`px-2 py-1 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            action.primary
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function PromptEditor({
  mode,
  promptText,
  newPromptName,
  isValid,
  validationError,
  operationError,
  isSystemPrompt,
  isLoading,
  onPromptTextChange,
  onNewPromptNameChange,
  onApply,
  onUpdate,
  onSaveNew,
  onConfirmSaveNew,
  onBackFromSaveNew,
  onCancel,
}: PromptEditorProps): React.JSX.Element | null {
  const config = getModeConfig(mode, isValid, isSystemPrompt, newPromptName, {
    onApply,
    onUpdate,
    onSaveNew,
    onConfirmSaveNew,
    onBackFromSaveNew,
    onCancel,
  });

  if (!config) return null;

  if (isLoading) {
    return (
      <div className="mt-2 p-2 bg-white rounded border border-gray-200">
        <div className="text-xs text-gray-400">Loading prompt...</div>
      </div>
    );
  }

  return (
    <div className="mt-2 p-2 bg-white rounded border border-gray-200 space-y-2">
      {/* Textarea for prompt editing */}
      <textarea
        value={promptText}
        onChange={(e) => { onPromptTextChange(e.target.value); }}
        placeholder="Enter prompt with {{transcript}} placeholder..."
        className="w-full h-36 p-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
      />

      {/* Validation error */}
      {validationError && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <span>&#9888;</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* Operation error (save/update failures) */}
      {operationError && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <span>&#9888;</span>
          <span>{operationError}</span>
        </div>
      )}

      {/* Save new prompt name input */}
      {config.showNameInput && (
        <div className="space-y-1">
          <label className="text-xs text-gray-500">New prompt name:</label>
          <input
            type="text"
            value={newPromptName}
            onChange={(e) => { onNewPromptNameChange(e.target.value); }}
            placeholder="Enter prompt name..."
            className="w-full px-2 py-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            autoFocus
          />
        </div>
      )}

      {/* Action buttons */}
      <ActionButtons actions={config.actions} />
    </div>
  );
}
