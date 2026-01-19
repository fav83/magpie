import { PromptEditor } from './PromptEditor';
import { usePromptEditor } from '../hooks/usePromptEditor';

interface PromptEditorSectionProps {
  promptId: string;
  customPromptText: string | undefined;
  onApplyCustomPrompt: (customPromptText: string) => void;
  onRegenerateWithPrompt: (promptId: string) => void;
}

export function PromptEditorSection({
  promptId,
  customPromptText,
  onApplyCustomPrompt,
  onRegenerateWithPrompt,
}: PromptEditorSectionProps): React.JSX.Element {
  const { state, form, validation, actions } = usePromptEditor({
    promptId,
    customPromptText,
    onApply: onApplyCustomPrompt,
    onUpdateOriginal: onRegenerateWithPrompt,
    onSaveAsNew: onRegenerateWithPrompt,
  });

  return (
    <>
      {/* Edit prompt link */}
      <div className="text-right">
        <button
          type="button"
          onClick={state.mode === 'closed' ? actions.open : actions.close}
          className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
        >
          {state.mode === 'closed' ? 'Edit prompt' : 'Close editor'}
        </button>
      </div>

      {/* Prompt editor */}
      <PromptEditor
        mode={state.mode}
        promptText={form.promptText}
        newPromptName={form.newPromptName}
        isValid={validation.isValid}
        validationError={validation.error}
        operationError={validation.operationError}
        isSystemPrompt={state.isSystemPrompt}
        isLoading={state.isLoading}
        onPromptTextChange={form.setPromptText}
        onNewPromptNameChange={form.setNewPromptName}
        onApply={actions.apply}
        onUpdate={() => { void actions.update(); }}
        onSaveNew={actions.saveNew}
        onConfirmSaveNew={() => { void actions.confirmSaveNew(); }}
        onBackFromSaveNew={actions.backFromSaveNew}
        onCancel={actions.close}
      />
    </>
  );
}
