import { useState, useEffect, useReducer } from 'react';
import { validateApiKeyFormat, validateApiKeyServer } from '../services/apiKeyValidation';
import { saveApiKey, loadApiKey } from '../services/storage';

type Phase = 'idle' | 'editing' | 'testing' | 'test-passed' | 'test-failed' | 'saving' | 'saved';

interface FormState {
  phase: Phase;
  statusMessage: string;
  statusType: 'success' | 'error' | 'info';
}

type FormAction =
  | { type: 'START_EDITING' }
  | { type: 'INPUT_CHANGED' }
  | { type: 'START_TEST' }
  | { type: 'TEST_PASSED' }
  | { type: 'TEST_FAILED'; message: string }
  | { type: 'START_SAVE' }
  | { type: 'SAVE_COMPLETE' }
  | { type: 'RESET' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'START_EDITING':
      return { phase: 'editing', statusMessage: '', statusType: 'info' };
    case 'INPUT_CHANGED':
      if (state.phase === 'test-passed' || state.phase === 'test-failed' || state.phase === 'saved') {
        return { phase: 'editing', statusMessage: '', statusType: 'info' };
      }
      return state;
    case 'START_TEST':
      return { phase: 'testing', statusMessage: 'Testing...', statusType: 'info' };
    case 'TEST_PASSED':
      return { phase: 'test-passed', statusMessage: 'API key is valid', statusType: 'success' };
    case 'TEST_FAILED':
      return { phase: 'test-failed', statusMessage: action.message, statusType: 'error' };
    case 'START_SAVE':
      return { phase: 'saving', statusMessage: 'Saving...', statusType: 'info' };
    case 'SAVE_COMPLETE':
      return { phase: 'saved', statusMessage: 'Saved', statusType: 'success' };
    case 'RESET':
      return { phase: 'idle', statusMessage: '', statusType: 'info' };
  }
}

function maskKey(key: string): string {
  if (key.length <= 9) return key;
  return key.slice(0, 6) + '\u2022'.repeat(Math.max(0, key.length - 9)) + key.slice(-3);
}

export function useApiKeyForm(onKeySaved: (key: string) => void) {
  const [inputValue, setInputValue] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [form, dispatch] = useReducer(formReducer, { phase: 'idle', statusMessage: '', statusType: 'info' });
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    void loadApiKey().then((key) => {
      if (key) {
        setSavedKey(key);
        setInputValue(key);
      }
    });
  }, []);

  const isEditing = isFocused || form.phase === 'editing' || form.phase === 'testing' || form.phase === 'test-passed' || form.phase === 'test-failed';
  const displayValue = isEditing ? inputValue : savedKey ? maskKey(savedKey) : '';
  const testDisabled = inputValue.trim() === '' || form.phase === 'testing' || form.phase === 'saving';
  const saveDisabled = form.phase !== 'test-passed';

  const handleFocus = () => {
    setIsFocused(true);
    if (form.phase === 'idle' || form.phase === 'saved') {
      dispatch({ type: 'START_EDITING' });
    }
  };

  const handleBlur = () => setIsFocused(false);

  const handleChange = (value: string) => {
    setInputValue(value);
    dispatch({ type: 'INPUT_CHANGED' });
  };

  const handleTest = async () => {
    const key = inputValue.trim();
    const formatError = validateApiKeyFormat(key);
    if (formatError) {
      dispatch({ type: 'TEST_FAILED', message: formatError });
      return;
    }

    dispatch({ type: 'START_TEST' });

    const result = await validateApiKeyServer(key);
    if (result.valid) {
      dispatch({ type: 'TEST_PASSED' });
    } else {
      dispatch({ type: 'TEST_FAILED', message: result.error });
    }
  };

  const handleSave = async () => {
    const key = inputValue.trim();
    dispatch({ type: 'START_SAVE' });

    await saveApiKey(key);
    setSavedKey(key);
    onKeySaved(key);

    dispatch({ type: 'SAVE_COMPLETE' });
    setTimeout(() => dispatch({ type: 'RESET' }), 2000);
  };

  return {
    form,
    isFocused,
    displayValue,
    testDisabled,
    saveDisabled,
    handleFocus,
    handleBlur,
    handleChange,
    handleTest,
    handleSave,
  };
}
