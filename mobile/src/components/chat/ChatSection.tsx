import type { ChatMessage as ChatMessageType } from '../../types/chat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatHeader } from './ChatHeader';

interface ChatSectionProps {
  messages: ChatMessageType[];
  isExpanded: boolean;
  isStreaming: boolean;
  streamingDisplayContent: string;
  onSend: (content: string) => void;
  onToggleExpanded: () => void;
  onCancelStreaming: () => void;
  onClear: () => void;
}

export function ChatSection({
  messages,
  isExpanded,
  isStreaming,
  streamingDisplayContent,
  onSend,
  onToggleExpanded,
  onCancelStreaming: _onCancelStreaming,
  onClear,
}: ChatSectionProps): React.JSX.Element {
  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors w-full"
      >
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Chat about this video
        {messages.length > 0 && (
          <span className="text-xs text-gray-400">({messages.length})</span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {messages.length > 0 && (
            <ChatHeader messages={messages} onClear={onClear} />
          )}

          {/* Messages */}
          <div className="space-y-0">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                streamingContent={
                  msg.status === 'streaming' ? streamingDisplayContent : undefined
                }
              />
            ))}
          </div>

          {/* Input */}
          <ChatInput onSend={onSend} disabled={isStreaming} />
        </div>
      )}
    </div>
  );
}
