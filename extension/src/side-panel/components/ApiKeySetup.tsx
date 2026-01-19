import { useApiKeyForm } from '../../hooks/useApiKeyForm';

export function ApiKeySetup(): React.JSX.Element {
  const {
    apiKey,
    setApiKey,
    error,
    isValidating,
    isNetworkError,
    validateAndSave,
    saveWithoutTest,
  } = useApiKeyForm();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void validateAndSave();
  };

  const handleSaveAnyway = () => {
    void saveWithoutTest();
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-xs space-y-4">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            API Key Required
          </h3>
          <p className="text-sm text-gray-500">
            Enter your OpenRouter API key to start generating summaries.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="api-key-input" className="sr-only">
              OpenRouter API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); }}
              placeholder="sk-or-..."
              aria-label="OpenRouter API Key"
              aria-describedby={error ? 'api-key-error' : undefined}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                error ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={isValidating}
            />
          </div>

          {error && (
            <p id="api-key-error" className="text-red-600 text-xs text-left" role="alert">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isValidating || !apiKey.trim()}
              className="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Apply'}
            </button>
            {isNetworkError && (
              <button
                type="button"
                onClick={handleSaveAnyway}
                className="py-2 px-3 text-sm font-medium rounded-lg transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Save anyway
              </button>
            )}
          </div>
        </form>

        <p className="text-xs text-gray-500">
          Get your key at{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            openrouter.ai/keys
          </a>
        </p>
      </div>
    </div>
  );
}
