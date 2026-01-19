import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';
import { ChatMessage } from './ChatMessage';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  streamingContent: string;
  fontSize: number;
}

export function ChatMessages({ messages, streamingContent, fontSize }: ChatMessagesProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  return (
    <div
      ref={containerRef}
      className="space-y-2 max-h-[60vh] overflow-y-auto bg-gray-100 rounded-lg p-1"
    >
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          streamingContent={message.status === 'streaming' ? streamingContent : undefined}
          fontSize={fontSize}
        />
      ))}
    </div>
  );
}
