import { useState, useEffect, useReducer } from 'react';
import { validateApiKeyFormat, validateApiKeyServer } from '../services/apiKeyValidation';
import { saveApiKey, loadApiKey } from '../services/storage';
import { Spinner, BackButton, NavButton, inputClass } from './ui';

type Phase = 'idle' | 'editing' | 'testing' | 'test-passed' | 'test-failed' | 'saving' | 'saved';

interface SettingsFormState {
  phase: Phase;
  statusMessage: string;
  statusType: 'success' | 'error' | 'info';
}

type SettingsAction =
  | { type: 'START_EDITING' }
  | { type: 'INPUT_CHANGED' }
  | { type: 'START_TEST' }
  | { type: 'TEST_PASSED' }
  | { type: 'TEST_FAILED'; message: string }
  | { type: 'START_SAVE' }
  | { type: 'SAVE_COMPLETE' }
  | { type: 'RESET' };

function settingsReducer(state: SettingsFormState, action: SettingsAction): SettingsFormState {
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

interface SettingsProps {
  onBack: () => void;
  onKeySaved: (key: string) => void;
  onManageFavoriteModels: () => void;
  onManagePrompts: () => void;
}

export function Settings({ onBack, onKeySaved, onManageFavoriteModels, onManagePrompts }: SettingsProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [form, dispatch] = useReducer(settingsReducer, { phase: 'idle', statusMessage: '', statusType: 'info' });
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 flex items-center">
        <BackButton onClick={onBack} />
        <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
      </header>

      <div className="px-4 pt-6 space-y-4">
        {/* API Key Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            OpenRouter API Key
          </label>
          <input
            type={isFocused ? 'text' : 'password'}
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setIsFocused(false)}
            placeholder="sk-or-..."
            className={`w-full placeholder-gray-400 ${inputClass}`}
            disabled={form.phase === 'testing' || form.phase === 'saving'}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testDisabled}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
              testDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {form.phase === 'testing' ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner className="h-4 w-4" />
                Testing
              </span>
            ) : (
              'Test'
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveDisabled}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
              saveDisabled
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {form.phase === 'saving' ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner className="h-4 w-4" />
                Saving
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>

        {/* Status Area */}
        {form.statusMessage && (
          <div className={`flex items-center gap-2 text-sm ${
            form.statusType === 'success' ? 'text-green-600' :
            form.statusType === 'error' ? 'text-red-600' :
            'text-gray-500'
          }`}>
            {form.statusType === 'success' && (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {form.statusType === 'error' && (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {form.statusType === 'info' && form.phase === 'testing' && (
              <Spinner className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{form.statusMessage}</span>
          </div>
        )}

        {/* Manage Favorite Models */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Models</label>
          <NavButton label="Manage Favorite Models" onClick={onManageFavoriteModels} />
        </div>

        {/* Manage Prompts */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Prompts</label>
          <NavButton label="Manage Prompts" onClick={onManagePrompts} />
        </div>

        {/* Help Link */}
        <div className="pt-4 text-sm text-gray-500">
          <span>Don't have a key? </span>
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Get one at openrouter.ai
          </a>
        </div>
      </div>
    </div>
  );
}
