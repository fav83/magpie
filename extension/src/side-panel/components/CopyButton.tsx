import { useState, useCallback } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import { Tooltip } from './Tooltip';
import { formatSummaryForClipboard } from '../../utils/clipboard';

interface CopyButtonProps {
  content: string;
  videoTitle?: string;
  videoUrl?: string;
  disabled?: boolean;
  variant?: 'icon' | 'text';
  className?: string;
}

export function CopyButton({
  content,
  videoTitle,
  videoUrl,
  disabled = false,
  variant = 'icon',
  className = '',
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!content || disabled) return;

    const textToCopy = formatSummaryForClipboard(content, videoTitle, videoUrl);
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  }, [content, videoTitle, videoUrl, disabled]);

  if (variant === 'text') {
    return (
      <button
        onClick={() => void handleCopy()}
        className={`text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 ${className}`}
        disabled={disabled || !content}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    );
  }

  return (
    <Tooltip content={copied ? 'Copied!' : 'Copy'}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? 'Copied' : 'Copy'}
        className={`p-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50 ${className}`}
        disabled={disabled || !content}
      >
        {copied ? (
          <CheckIcon className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <CopyIcon className="w-3.5 h-3.5 text-gray-700" />
        )}
      </button>
    </Tooltip>
  );
}
