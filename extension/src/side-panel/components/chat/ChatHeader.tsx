import { useState, useCallback } from 'react';
import { Tooltip } from '../Tooltip';
import { DeleteIcon, CopyIcon, CheckIcon } from '../Icons';

interface ChatHeaderProps {
  onClear?: () => void | Promise<void>;
  onCopyAll: () => string;
  hasMessages: boolean;
}

export function ChatHeader({ onClear, onCopyAll, hasMessages }: ChatHeaderProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(async () => {
    const text = onCopyAll();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  }, [onCopyAll]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 border-t border-gray-200" />
      <span className="text-xs text-gray-400 uppercase tracking-wide px-2">
        Chat
      </span>
      <div className="flex-1 border-t border-gray-200" />
      {hasMessages && (
        <div className="flex items-center gap-1">
          <Tooltip content={copied ? 'Copied!' : 'Copy chat'}>
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Copy chat"
            >
              {copied ? (
                <CheckIcon className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <CopyIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </Tooltip>
          {onClear && (
            <Tooltip content="Clear chat">
              <button
                type="button"
                onClick={() => void onClear()}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Clear chat"
              >
                <DeleteIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
