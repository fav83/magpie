import { useChromeStorage } from '../../hooks/useChromeStorage';
import { STORAGE_KEYS } from '../../config';
import { CompactModelSelector } from './CompactModelSelector';

interface ErrorProps {
  message: string;
  onRetry: () => void;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}

export function Error({
  message,
  onRetry,
  selectedModelId,
  onModelChange,
}: ErrorProps): React.JSX.Element {
  const [apiKey] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);
  const showModelSelector = selectedModelId !== undefined && onModelChange !== undefined;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <p className="text-red-700 mb-3">{message}</p>
      {showModelSelector && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm text-gray-600">Try a different model:</span>
          <CompactModelSelector
            value={selectedModelId}
            onChange={onModelChange}
            apiKey={apiKey}
          />
        </div>
      )}
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
