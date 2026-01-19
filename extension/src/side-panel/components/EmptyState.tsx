import { VideoIcon } from './Icons';

export function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-gray-400">
        <VideoIcon className="w-12 h-12" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Summaries Yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Navigate to a YouTube video to generate your first summary.
      </p>
    </div>
  );
}
