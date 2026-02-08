import { useState, useEffect } from 'react';
import { validateApiKeyFormat, validateApiKeyServer } from '../services/apiKeyValidation';
import { saveApiKey, loadApiKey } from '../services/storage';
import { Spinner, BackButton } from './ui';

type SettingsState = 'idle' | 'editing' | 'testing' | 'test-passed' | 'test-failed' | 'saving' | 'saved';

function maskKey(key: string): string {
  if (key.length <= 9) return key;
  return key.slice(0, 6) + '\u2022'.repeat(Math.max(0, key.length - 9)) + key.slice(-3);
}

interface SettingsProps {
  onBack: () => void;
  onKeySaved: (key: string) => void;
  onManagePrompts: () => void;
}

export function Settings({ onBack, onKeySaved, onManagePrompts }: SettingsProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [settingsState, setSettingsState] = useState<SettingsState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    void loadApiKey().then((key) => {
      if (key) {
        setSavedKey(key);
        setInputValue(key);
      }
    });
  }, []);

  const displayValue = isFocused || settingsState === 'editing' || settingsState === 'testing' || settingsState === 'test-passed' || settingsState === 'test-failed'
    ? inputValue
    : savedKey ? maskKey(savedKey) : '';

  const testDisabled = inputValue.trim() === '' || settingsState === 'testing' || settingsState === 'saving';
  const saveDisabled = settingsState !== 'test-passed';

  const handleFocus = () => {
    setIsFocused(true);
    if (settingsState === 'idle' || settingsState === 'saved') {
      setSettingsState('editing');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleChange = (value: string) => {
    setInputValue(value);
    if (settingsState === 'test-passed' || settingsState === 'test-failed' || settingsState === 'saved') {
      setSettingsState('editing');
      setStatusMessage('');
    }
  };

  const handleTest = async () => {
    const key = inputValue.trim();
    const formatError = validateApiKeyFormat(key);
    if (formatError) {
      setSettingsState('test-failed');
      setStatusType('error');
      setStatusMessage(formatError);
      return;
    }

    setSettingsState('testing');
    setStatusType('info');
    setStatusMessage('Testing...');

    const result = await validateApiKeyServer(key);
    if (result.valid) {
      setSettingsState('test-passed');
      setStatusType('success');
      setStatusMessage('API key is valid');
    } else {
      setSettingsState('test-failed');
      setStatusType('error');
      setStatusMessage(result.error);
    }
  };

  const handleSave = async () => {
    const key = inputValue.trim();
    setSettingsState('saving');
    setStatusType('info');
    setStatusMessage('Saving...');

    await saveApiKey(key);
    setSavedKey(key);
    onKeySaved(key);

    setSettingsState('saved');
    setStatusType('success');
    setStatusMessage('Saved');

    setTimeout(() => {
      setStatusMessage('');
      setSettingsState('idle');
    }, 2000);
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
            onBlur={handleBlur}
            placeholder="sk-or-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={settingsState === 'testing' || settingsState === 'saving'}
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
            {settingsState === 'testing' ? (
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
            {settingsState === 'saving' ? (
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
        {statusMessage && (
          <div className={`flex items-center gap-2 text-sm ${
            statusType === 'success' ? 'text-green-600' :
            statusType === 'error' ? 'text-red-600' :
            'text-gray-500'
          }`}>
            {statusType === 'success' && (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {statusType === 'error' && (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {statusType === 'info' && settingsState === 'testing' && (
              <Spinner className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Manage Prompts */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Prompts</label>
          <button
            type="button"
            onClick={onManagePrompts}
            className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <span>Manage Prompts</span>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
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
