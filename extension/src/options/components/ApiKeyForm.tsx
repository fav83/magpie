import { useApiKeyForm } from '../../hooks/useApiKeyForm';

export function ApiKeyForm(): React.JSX.Element {
  const {
    apiKey,
    setApiKey,
    error,
    isModified,
    isValidating,
    isSaved,
    testResult,
    saveWithoutTest,
    testKey,
  } = useApiKeyForm({ syncWithStored: true });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void saveWithoutTest();
  };

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          OpenRouter API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); }}
          placeholder="sk-or-..."
          className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isModified ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
          }`}
        />
        <p className="text-xs text-gray-500 mt-1">
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

      {/* Status messages - compact */}
      <div className="min-h-[20px]">
        {error && <p className="text-red-600 text-xs">{error}</p>}
        {isSaved && !isModified && <p className="text-green-600 text-xs">Saved!</p>}
        {testResult === 'success' && (
          <p className="text-green-600 text-xs">API key is valid!</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void testKey()}
          disabled={isValidating || !apiKey}
          className="flex-1 py-1.5 px-3 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating ? 'Testing...' : 'Test'}
        </button>
        <button
          type="submit"
          disabled={!isModified}
          className={`flex-1 py-1.5 px-3 text-sm rounded-md transition-colors ${
            isModified
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Save
        </button>
      </div>
    </form>
  );
}
