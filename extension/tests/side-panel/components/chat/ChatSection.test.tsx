import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatSection } from '../../../../src/side-panel/components/chat/ChatSection';
import { setupChromeMock, resetChromeMock, type MockFn } from '../../../mocks/chrome';
import type { ChatMessage } from '../../../../src/types/chat';

// Mock useFontSize
vi.mock('../../../../src/hooks/useFontSize', () => ({
  useFontSize: () => 14,
}));

// Mock useVideoChat
const mockUseVideoChat: {
  messages: ChatMessage[];
  isExpanded: boolean;
  isStreaming: boolean;
  streamingContent: string;
  sendMessage: MockFn;
  cancelStreaming: MockFn;
  clearChat: MockFn;
  toggleExpanded: MockFn;
  setExpanded: MockFn;
} = {
  messages: [],
  isExpanded: false,
  isStreaming: false,
  streamingContent: '',
  sendMessage: vi.fn(),
  cancelStreaming: vi.fn(),
  clearChat: vi.fn(),
  toggleExpanded: vi.fn(),
  setExpanded: vi.fn(),
};

vi.mock('../../../../src/side-panel/hooks/useVideoChat', () => ({
  useVideoChat: () => mockUseVideoChat,
}));

// Mock child components
vi.mock('../../../../src/side-panel/components/chat/ChatHeader', () => ({
  ChatHeader: ({ onClear, hasMessages }: { onClear?: () => void; hasMessages: boolean }) => (
    <div data-testid="chat-header" data-has-messages={hasMessages} data-has-clear={!!onClear}>
      Header
    </div>
  ),
}));

vi.mock('../../../../src/side-panel/components/chat/ChatMessages', () => ({
  ChatMessages: ({ messages, fontSize }: { messages: unknown[]; fontSize: number }) => (
    <div data-testid="chat-messages" data-count={messages.length} data-fontsize={fontSize}>
      Messages
    </div>
  ),
}));

vi.mock('../../../../src/side-panel/components/chat/ChatInput', () => ({
  ChatInput: ({ isStreaming, fontSize }: { isStreaming: boolean; fontSize: number }) => (
    <div data-testid="chat-input" data-streaming={isStreaming} data-fontsize={fontSize}>
      Input
    </div>
  ),
}));

describe('ChatSection', () => {
  const defaultProps = {
    videoId: 'video123',
    tabId: 1,
    summary: 'Video summary',
    modelId: 'openai/gpt-4o-mini',
  };

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
    // Reset mock state
    mockUseVideoChat.messages = [];
    mockUseVideoChat.isExpanded = false;
    mockUseVideoChat.isStreaming = false;
  });

  describe('collapsed state', () => {
    it('should show "Show chat" link when not expanded', () => {
      render(<ChatSection {...defaultProps} />);

      expect(screen.getByText(/Show chat/)).toBeInTheDocument();
    });

    it('should call toggleExpanded when "Show chat" is clicked', () => {
      render(<ChatSection {...defaultProps} />);

      fireEvent.click(screen.getByText(/Show chat/));

      expect(mockUseVideoChat.toggleExpanded).toHaveBeenCalled();
    });
  });

  describe('expanded state', () => {
    beforeEach(() => {
      mockUseVideoChat.isExpanded = true;
    });

    it('should show chat components when expanded', () => {
      render(<ChatSection {...defaultProps} />);

      expect(screen.getByTestId('chat-header')).toBeInTheDocument();
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('should show empty state when no messages', () => {
      render(<ChatSection {...defaultProps} />);

      expect(screen.getByText('Ask a question about this video')).toBeInTheDocument();
    });

    it('should show messages component when has messages', () => {
      mockUseVideoChat.messages = [{ id: 'msg1', role: 'user', content: 'Hello', status: 'complete' }];

      render(<ChatSection {...defaultProps} />);

      expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
      expect(screen.queryByText('Ask a question about this video')).not.toBeInTheDocument();
    });

    it('should show "Hide chat" link', () => {
      render(<ChatSection {...defaultProps} />);

      expect(screen.getByText(/Hide chat/)).toBeInTheDocument();
    });

    it('should call toggleExpanded when "Hide chat" is clicked', () => {
      render(<ChatSection {...defaultProps} />);

      fireEvent.click(screen.getByText(/Hide chat/));

      expect(mockUseVideoChat.toggleExpanded).toHaveBeenCalled();
    });

    it('should pass onClear to header', () => {
      render(<ChatSection {...defaultProps} />);

      expect(screen.getByTestId('chat-header')).toHaveAttribute('data-has-clear', 'true');
    });
  });

  describe('readonly mode', () => {
    it('should return null when readonly and no messages', () => {
      const { container } = render(<ChatSection videoId="video123" readonly />);

      expect(container.firstChild).toBeNull();
    });

    it('should show "View chat" link when readonly with messages', () => {
      mockUseVideoChat.messages = [{ id: 'msg1', role: 'user', content: 'Hello', status: 'complete' }];

      render(<ChatSection videoId="video123" readonly />);

      expect(screen.getByText(/View chat/)).toBeInTheDocument();
    });

    it('should hide input in readonly mode when expanded', () => {
      mockUseVideoChat.isExpanded = true;
      mockUseVideoChat.messages = [{ id: 'msg1', role: 'user', content: 'Hello', status: 'complete' }];

      render(<ChatSection videoId="video123" readonly />);

      expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument();
    });

    it('should not pass onClear to header in readonly mode', () => {
      mockUseVideoChat.isExpanded = true;
      mockUseVideoChat.messages = [{ id: 'msg1', role: 'user', content: 'Hello', status: 'complete' }];

      render(<ChatSection videoId="video123" readonly />);

      expect(screen.getByTestId('chat-header')).toHaveAttribute('data-has-clear', 'false');
    });
  });
});
