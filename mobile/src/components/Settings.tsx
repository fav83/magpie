import { useApiKeyForm } from '../hooks/useApiKeyForm';
import { Spinner, BackButton, NavButton, inputClass } from './ui';

interface SettingsProps {
  onBack: () => void;
  onKeySaved: (key: string) => void;
  onManageFavoriteModels: () => void;
  onManagePrompts: () => void;
  fontScale: number;
  onFontScaleChange: (scale: number) => void;
}

export function Settings({ onBack, onKeySaved, onManageFavoriteModels, onManagePrompts, fontScale, onFontScaleChange }: SettingsProps): React.JSX.Element {
  const {
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
  } = useApiKeyForm(onKeySaved);

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
            className={`w-full placeholder-gray-400 ${inputClass}`}
            disabled={form.phase === 'testing' || form.phase === 'saving'}
          />
          <p className="mt-1 text-sm text-gray-500">
            <span>Don't have a key? </span>
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Get one at openrouter.ai
            </a>
          </p>
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

        {/* Font Size */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-8 text-right">50%</span>
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={fontScale}
              onChange={(e) => onFontScaleChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-xs text-gray-500 w-8">200%</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm text-gray-600">{fontScale}%</span>
            {fontScale !== 100 && (
              <button
                type="button"
                onClick={() => onFontScaleChange(100)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>

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

      </div>
    </div>
  );
}
