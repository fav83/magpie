import { useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  streamingContent?: string | undefined;
}

export function ChatMessage({ message, streamingContent }: ChatMessageProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const displayContent = isStreaming ? (streamingContent ?? '') : message.content;

  const handleCopy = useCallback(async () => {
    if (!displayContent) return;
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [displayContent]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm text-left ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{displayContent}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <Markdown>{displayContent}</Markdown>
            {isStreaming && <span className="animate-blink text-gray-400">&#9610;</span>}
          </div>
        )}

        {isError && message.error && (
          <span className="inline-block mt-1 text-xs text-amber-600 italic">{message.error}</span>
        )}

        {copied && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-0.5 rounded whitespace-nowrap">
            Copied!
          </span>
        )}
      </button>
    </div>
  );
}
