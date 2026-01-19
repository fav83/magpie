import { ERROR_MESSAGES } from '../../config';

interface InlineErrorProps {
  message: string;
  onRetry: (() => void) | undefined;
  isStopped?: boolean;
}

function openSettings(): void {
  void chrome.runtime.openOptionsPage();
}

export function InlineError({ message, onRetry, isStopped = false }: InlineErrorProps): React.JSX.Element {
  // Check if this is specifically a "no API key" error (not "invalid API key")
  const isNoApiKeyError = message === ERROR_MESSAGES.NO_API_KEY;

  // Use amber colors for stopped items, red for errors
  const bgColor = isStopped ? 'bg-amber-50' : 'bg-red-50';
  const textColor = isStopped ? 'text-amber-700' : 'text-red-700';
  const buttonBgColor = isStopped ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700';
  const linkHoverColor = isStopped ? 'hover:text-amber-900' : 'hover:text-red-900';

  return (
    <div className={`${bgColor} rounded p-2 text-sm flex items-center justify-between gap-2`}>
      {isNoApiKeyError ? (
        <p className={textColor}>
          Please add your API key in{' '}
          <button
            onClick={openSettings}
            className={`underline ${linkHoverColor} font-medium`}
          >
            settings
          </button>
          .
        </p>
      ) : (
        <p className={textColor}>{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className={`flex-shrink-0 px-2 py-1 ${buttonBgColor} text-white text-xs rounded`}
        >
          Retry
        </button>
      )}
    </div>
  );
}
