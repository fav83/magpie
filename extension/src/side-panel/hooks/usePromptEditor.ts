import { useState, useCallback, useEffect } from 'react';
import { getPromptById, validatePromptText, addPrompt, updatePrompt } from '../../utils/promptStorage';

export type EditorMode = 'closed' | 'editing' | 'saving-new';

interface UsePromptEditorOptions {
  promptId: string;
  customPromptText: string | undefined;
  onApply: (promptText: string) => void;
  onUpdateOriginal: (promptId: string) => void;
  onSaveAsNew: (newPromptId: string) => void;
}

export interface EditorState {
  mode: EditorMode;
  isLoading: boolean;
  isSystemPrompt: boolean;
}

export interface FormState {
  promptText: string;
  newPromptName: string;
  setPromptText: (text: string) => void;
  setNewPromptName: (name: string) => void;
}

export interface ValidationState {
  isValid: boolean;
  error: string | undefined;
  operationError: string | undefined;
}

export interface EditorActions {
  open: () => void;
  close: () => void;
  apply: () => void;
  update: () => Promise<void>;
  saveNew: () => void;
  confirmSaveNew: () => Promise<void>;
  backFromSaveNew: () => void;
}

interface UsePromptEditorReturn {
  state: EditorState;
  form: FormState;
  validation: ValidationState;
  actions: EditorActions;
}

export function usePromptEditor({
  promptId,
  customPromptText,
  onApply,
  onUpdateOriginal,
  onSaveAsNew,
}: UsePromptEditorOptions): UsePromptEditorReturn {
  const [mode, setMode] = useState<EditorMode>('closed');
  const [promptText, setPromptText] = useState('');
  const [originalPromptText, setOriginalPromptText] = useState('');
  const [newPromptName, setNewPromptName] = useState('');
  const [originalPromptName, setOriginalPromptName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSystemPrompt, setIsSystemPrompt] = useState(false);
  const [operationError, setOperationError] = useState<string | undefined>(undefined);

  // Validate prompt text
  const validation = validatePromptText(promptText);
  const isValid = validation.valid;
  const validationError = validation.valid ? undefined : validation.error;

  // Load prompt text when editor opens
  const loadPromptText = useCallback(async () => {
    setIsLoading(true);
    try {
      // Always load the prompt from storage to get name and system flag
      const prompt = await getPromptById(promptId);
      if (prompt) {
        setOriginalPromptName(prompt.name);
        setIsSystemPrompt(prompt.isSystem);
      }

      // If there's custom prompt text stored with the item, use that for editing
      if (customPromptText) {
        setPromptText(customPromptText);
        setOriginalPromptText(customPromptText);
      } else if (prompt) {
        // Otherwise use the prompt text from storage
        setPromptText(prompt.text);
        setOriginalPromptText(prompt.text);
      }
    } finally {
      setIsLoading(false);
    }
  }, [promptId, customPromptText]);

  // Reset when promptId changes (user selects different prompt)
  useEffect(() => {
    if (mode === 'editing') {
      void loadPromptText();
    }
  }, [promptId, mode, loadPromptText]);

  const openEditor = useCallback(() => {
    setMode('editing');
    void loadPromptText();
  }, [loadPromptText]);

  const closeEditor = useCallback(() => {
    setMode('closed');
    setPromptText('');
    setNewPromptName('');
    setOperationError(undefined);
  }, []);

  const handleApply = useCallback(() => {
    if (!isValid) return;
    onApply(promptText);
    closeEditor();
  }, [isValid, promptText, onApply, closeEditor]);

  const handleUpdate = useCallback(async () => {
    if (!isValid || isSystemPrompt) return;
    setOperationError(undefined);

    try {
      await updatePrompt(promptId, { text: promptText });
      onUpdateOriginal(promptId);
      closeEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update prompt';
      setOperationError(message);
    }
  }, [isValid, isSystemPrompt, promptId, promptText, onUpdateOriginal, closeEditor]);

  const handleSaveNew = useCallback(() => {
    // Generate default name
    const baseName = originalPromptName || 'Prompt';
    setNewPromptName(`Copy of ${baseName}`);
    setMode('saving-new');
  }, [originalPromptName]);

  const handleConfirmSaveNew = useCallback(async () => {
    if (!isValid || !newPromptName.trim()) return;
    setOperationError(undefined);

    try {
      const newPrompt = await addPrompt(newPromptName.trim(), promptText);
      onSaveAsNew(newPrompt.id);
      closeEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save prompt';
      setOperationError(message);
    }
  }, [isValid, newPromptName, promptText, onSaveAsNew, closeEditor]);

  const handleBackFromSaveNew = useCallback(() => {
    setMode('editing');
    setNewPromptName('');
  }, []);

  // Only show validation error after user has modified the text
  const shouldShowValidationError = promptText !== originalPromptText;

  return {
    state: {
      mode,
      isLoading,
      isSystemPrompt,
    },
    form: {
      promptText,
      newPromptName,
      setPromptText,
      setNewPromptName,
    },
    validation: {
      isValid: isValid && (mode !== 'saving-new' || !!newPromptName.trim()),
      error: shouldShowValidationError ? validationError : undefined,
      operationError,
    },
    actions: {
      open: openEditor,
      close: closeEditor,
      apply: handleApply,
      update: handleUpdate,
      saveNew: handleSaveNew,
      confirmSaveNew: handleConfirmSaveNew,
      backFromSaveNew: handleBackFromSaveNew,
    },
  };
}
