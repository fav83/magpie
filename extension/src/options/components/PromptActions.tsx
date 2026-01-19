interface PromptActionsProps {
  isNew: boolean;
  isSystem: boolean;
  isDefault: boolean;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onCancel: () => void;
}

export function PromptActions({
  isNew,
  isSystem,
  isDefault,
  canSave,
  isSaving,
  onSave,
  onDuplicate,
  onDelete,
  onSetDefault,
  onCancel,
}: PromptActionsProps): React.JSX.Element {
  if (isNew) {
    return (
      <div className="flex gap-2 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Creating...' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving || isSystem}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          Duplicate
        </button>
        {!isSystem && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 text-sm bg-gray-100 text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
      {!isDefault && (
        <button
          type="button"
          onClick={onSetDefault}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          Set as Default
        </button>
      )}
    </div>
  );
}
