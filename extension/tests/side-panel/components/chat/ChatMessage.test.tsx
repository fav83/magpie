import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatMessage } from '../../../../src/side-panel/components/chat/ChatMessage';
import type { ChatMessage as ChatMessageType } from '../../../../src/types/chat';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('ChatMessage', () => {
  const defaultProps = {
    fontSize: 14,
  };

  const createMessage = (overrides?: Partial<ChatMessageType>): ChatMessageType => ({
    id: 'msg_123',
    role: 'user',
    content: 'Hello, world!',
    status: 'complete',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('user messages', () => {
    it('should render user message with user icon', () => {
      const message = createMessage({ role: 'user' });
      render(<ChatMessage message={message} {...defaultProps} />);

      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
      expect(screen.getByText('👤')).toBeInTheDocument();
    });

    it('should apply blue background for user messages', () => {
      const message = createMessage({ role: 'user' });
      const { container } = render(<ChatMessage message={message} {...defaultProps} />);

      const messageDiv = container.firstChild as HTMLElement;
      expect(messageDiv.className).toContain('bg-blue-100');
    });
  });

  describe('assistant messages', () => {
    it('should render assistant message with robot icon', () => {
      const message = createMessage({ role: 'assistant' });
      render(<ChatMessage message={message} {...defaultProps} />);

      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should apply white background for assistant messages', () => {
      const message = createMessage({ role: 'assistant' });
      const { container } = render(<ChatMessage message={message} {...defaultProps} />);

      const messageDiv = container.firstChild as HTMLElement;
      expect(messageDiv.className).toContain('bg-white');
    });
  });

  describe('streaming state', () => {
    it('should show streaming cursor when streaming', () => {
      const message = createMessage({ status: 'streaming', content: '' });
      render(<ChatMessage message={message} streamingContent="Typing..." {...defaultProps} />);

      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should display streaming content when provided', () => {
      const message = createMessage({ status: 'streaming', content: '' });
      render(<ChatMessage message={message} streamingContent="Partial response" {...defaultProps} />);

      expect(screen.getByText('Partial response')).toBeInTheDocument();
    });

    it('should hide copy button during streaming', () => {
      const message = createMessage({ status: 'streaming', content: '' });
      render(<ChatMessage message={message} streamingContent="Typing..." {...defaultProps} />);

      expect(screen.queryByLabelText('Copy message')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should apply red background for assistant error messages', () => {
      const message = createMessage({ role: 'assistant', status: 'error', error: 'Something went wrong' });
      const { container } = render(<ChatMessage message={message} {...defaultProps} />);

      const messageDiv = container.firstChild as HTMLElement;
      expect(messageDiv.className).toContain('bg-red-100');
    });

    it('should display error message', () => {
      const message = createMessage({ role: 'assistant', status: 'error', error: 'API error occurred' });
      render(<ChatMessage message={message} {...defaultProps} />);

      expect(screen.getByText('API error occurred')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('should show copy button on hover for complete messages', () => {
      const message = createMessage({ status: 'complete' });
      render(<ChatMessage message={message} {...defaultProps} />);

      expect(screen.getByLabelText('Copy message')).toBeInTheDocument();
    });

    it('should copy message content when clicked', async () => {
      const message = createMessage({ content: 'Copy this text' });
      render(<ChatMessage message={message} {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Copy message'));

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy this text');
      });
    });

    it('should show check icon after copying', async () => {
      const message = createMessage();
      render(<ChatMessage message={message} {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Copy message'));

      await waitFor(() => {
        expect(screen.getByTitle('Copied!')).toBeInTheDocument();
      });
    });
  });

  describe('font size', () => {
    it('should apply provided font size', () => {
      const message = createMessage();
      const { container } = render(<ChatMessage message={message} fontSize={18} />);

      const contentDiv = container.querySelector('.markdown-content') as HTMLElement;
      expect(contentDiv.style.fontSize).toBe('18px');
    });
  });
});
