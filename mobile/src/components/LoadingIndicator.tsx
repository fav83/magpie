import { Spinner } from './ui';

type LoadingState = 'fetching-transcript' | 'generating-summary';

export function LoadingIndicator({ state }: { state: LoadingState }): React.JSX.Element {
  const message = state === 'fetching-transcript' ? 'Fetching transcript...' : 'Generating summary...';
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
      <Spinner className="h-5 w-5" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
