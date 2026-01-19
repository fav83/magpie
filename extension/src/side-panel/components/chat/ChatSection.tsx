import { useCallback } from 'react';
import { useVideoChat, type UseVideoChatProps } from '../../hooks/useVideoChat';
import { useFontSize } from '../../../hooks/useFontSize';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

interface ChatSectionProps {
  videoId: string;
  tabId?: number;
  summary?: string;
  modelId?: string;
  readonly?: boolean;
}

function buildChatProps(props: ChatSectionProps): UseVideoChatProps {
  const { videoId, tabId, summary, modelId, readonly } = props;
  if (readonly) {
    return { videoId, readonly: true };
  }
  // In interactive mode, these should always be provided
  // Fall back to readonly mode if required props are missing
  if (tabId === undefined || summary === undefined || modelId === undefined) {
    return { videoId, readonly: true };
  }
  return { videoId, tabId, summary, modelId };
}

export function ChatSection(props: ChatSectionProps): React.JSX.Element | null {
  const { readonly = false } = props;
  const fontSize = useFontSize();
  const chatProps = buildChatProps(props);

  const {
    messages,
    isExpanded,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStreaming,
    clearChat,
    toggleExpanded,
  } = useVideoChat(chatProps);

  // Format all messages for copying (must be before any early returns to follow hooks rules)
  const formatAllMessages = useCallback(() => {
    return messages
      .filter((m) => m.status === 'complete')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
  }, [messages]);

  // In readonly mode, don't show anything if there are no messages
  if (readonly && messages.length === 0) {
    return null;
  }

  // Chat toggle link
  if (!isExpanded) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleExpanded}
          className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
        >
          {readonly ? 'View chat' : 'Show chat'} &rarr;
        </button>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="mt-3 space-y-3">
      <ChatHeader
        {...(readonly ? {} : { onClear: clearChat })}
        onCopyAll={formatAllMessages}
        hasMessages={hasMessages}
      />

      {hasMessages ? (
        <ChatMessages messages={messages} streamingContent={streamingContent} fontSize={fontSize} />
      ) : (
        <div className="text-center text-gray-400 py-4" style={{ fontSize }}>
          Ask a question about this video
        </div>
      )}

      {!readonly && (
        <ChatInput
          onSend={sendMessage}
          onCancel={cancelStreaming}
          isStreaming={isStreaming}
          fontSize={fontSize}
        />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleExpanded}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
        >
          Hide chat &uarr;
        </button>
      </div>
    </div>
  );
}
