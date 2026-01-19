import { VideoUrlButton } from './VideoUrlButton';
import { ChevronDownIcon, ChevronRightIcon } from './Icons';
import { FONT_SIZE } from '../../config';

interface AccordionSkeletonProps {
  videoTitle: string;
  videoUrl: string;
  promptName: string;
  modelId: string;
  isCurrentVideo: boolean;
}

export function AccordionSkeleton({
  videoTitle,
  videoUrl,
  promptName,
  isCurrentVideo,
}: AccordionSkeletonProps): React.JSX.Element {
  const containerClasses = isCurrentVideo
    ? 'bg-gray-100'
    : 'border-b border-gray-100';

  // Collapsed state for non-current videos (loading in background)
  if (!isCurrentVideo) {
    return (
      <div className={containerClasses}>
        <div className="flex items-start gap-1.5 px-2 py-1.5">
          <span className="text-gray-400 mt-0.5 flex-shrink-0">
            <ChevronRightIcon className="w-3 h-3" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{videoTitle}</p>
            <p className="text-gray-500 truncate">
              Prompt: {promptName}
              <span className="ml-2 text-gray-400 animate-pulse">Loading...</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Expanded skeleton for current video
  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-start gap-1.5 px-2 py-1.5">
        <span className="text-gray-400 mt-0.5 flex-shrink-0">
          <ChevronDownIcon className="w-3 h-3" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{videoTitle}</p>
          <p className="text-gray-500 truncate">Prompt: {promptName}</p>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="px-4 pb-3 space-y-2">
        {/* Video URL link */}
        <VideoUrlButton url={videoUrl} fontSize={FONT_SIZE.DEFAULT} />

        <div className="space-y-1.5 animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="animate-pulse">Generating summary...</span>
        </div>
      </div>
    </div>
  );
}
