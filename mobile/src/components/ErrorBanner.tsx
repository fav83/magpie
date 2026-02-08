interface ErrorBannerProps {
  message: string;
  onGoToSettings?: (() => void) | undefined;
}

export function ErrorBanner({ message, onGoToSettings }: ErrorBannerProps): React.JSX.Element {
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-700">
        {message}
        {onGoToSettings && (
          <>
            {' '}
            <button onClick={onGoToSettings} className="underline font-medium">
              Go to Settings
            </button>
            {' '}to add your key.
          </>
        )}
      </p>
    </div>
  );
}
