import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';
import { CopyIcon, CheckIcon } from '../Icons';

interface ChatMessageProps {
  message: ChatMessageType;
  streamingContent?: string | undefined;
  fontSize: number;
}

export function ChatMessage({ message, streamingContent, fontSize }: ChatMessageProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const isStreaming = message.status === 'streaming';
  const hasError = message.status === 'error';

  // Use streaming content if available, otherwise use message content
  const displayContent = isStreaming && streamingContent !== undefined
    ? streamingContent
    : message.content;

  const isUser = message.role === 'user';

  const handleCopy = useCallback(async () => {
    if (!displayContent) return;
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  }, [displayContent]);

  return (
    <div
      className={`group relative rounded-lg px-2 py-1.5 ${
        isUser
          ? 'bg-blue-100 text-gray-800'
          : hasError
            ? 'bg-red-100 text-gray-800'
            : 'bg-white text-gray-800'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 text-sm">
          {isUser ? '👤' : '🤖'}
        </span>
        <div className="flex-1 min-w-0 overflow-hidden">
          {displayContent ? (
            <div
              className="leading-relaxed markdown-content prose prose-sm max-w-none"
              style={{ fontSize }}
            >
              <ReactMarkdown>{displayContent}</ReactMarkdown>
              {isStreaming && <span className="streaming-cursor">▊</span>}
            </div>
          ) : isStreaming ? (
            <div className="text-gray-500" style={{ fontSize }}>
              <span className="streaming-cursor">▊</span>
            </div>
          ) : null}

          {hasError && message.error && (
            <div className="mt-2 text-xs text-red-600">
              {message.error}
            </div>
          )}
        </div>

        {/* Copy button - visible on hover */}
        {displayContent && !isStreaming && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Copy message"
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? (
              <CheckIcon className="w-3 h-3 text-green-600" />
            ) : (
              <CopyIcon className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
