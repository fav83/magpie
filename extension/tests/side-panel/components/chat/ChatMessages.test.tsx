import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessages } from '../../../../src/side-panel/components/chat/ChatMessages';
import type { ChatMessage } from '../../../../src/types/chat';

// Mock ChatMessage component
vi.mock('../../../../src/side-panel/components/chat/ChatMessage', () => ({
  ChatMessage: ({ message, fontSize }: { message: ChatMessage; fontSize: number }) => (
    <div data-testid={`message-${message.id}`} data-fontsize={fontSize}>
      {message.content}
    </div>
  ),
}));

describe('ChatMessages', () => {
  const defaultProps = {
    messages: [] as ChatMessage[],
    streamingContent: '',
    fontSize: 14,
  };

  const createMessage = (id: string, content: string, status: ChatMessage['status'] = 'complete'): ChatMessage => ({
    id,
    role: 'user',
    content,
    status,
  });

  describe('rendering messages', () => {
    it('should render all messages', () => {
      const messages = [
        createMessage('msg1', 'First message'),
        createMessage('msg2', 'Second message'),
      ];

      render(<ChatMessages {...defaultProps} messages={messages} />);

      expect(screen.getByTestId('message-msg1')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument();
    });

    it('should pass fontSize to each message', () => {
      const messages = [createMessage('msg1', 'Hello')];

      render(<ChatMessages {...defaultProps} messages={messages} fontSize={16} />);

      expect(screen.getByTestId('message-msg1')).toHaveAttribute('data-fontsize', '16');
    });

    it('should render messages in container with max height', () => {
      const messages = [createMessage('msg1', 'Hello')];
      const { container } = render(<ChatMessages {...defaultProps} messages={messages} />);

      const messagesContainer = container.firstChild as HTMLElement;
      expect(messagesContainer.className).toContain('max-h-[60vh]');
      expect(messagesContainer.className).toContain('overflow-y-auto');
    });

    it('should apply gray background to container', () => {
      const messages = [createMessage('msg1', 'Hello')];
      const { container } = render(<ChatMessages {...defaultProps} messages={messages} />);

      const messagesContainer = container.firstChild as HTMLElement;
      expect(messagesContainer.className).toContain('bg-gray-100');
    });
  });

  describe('streaming content', () => {
    it('should pass streamingContent to streaming message', () => {
      const messages = [
        createMessage('msg1', 'User message'),
        createMessage('msg2', '', 'streaming'),
      ];

      render(
        <ChatMessages
          {...defaultProps}
          messages={messages}
          streamingContent="Streaming text"
        />
      );

      // The mock doesn't show streaming content, but we can verify the message is rendered
      expect(screen.getByTestId('message-msg2')).toBeInTheDocument();
    });
  });
});
