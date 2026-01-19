import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StreamingAccordionItem } from '../../../src/side-panel/components/StreamingAccordionItem';
import type { StreamingItem } from '../../../src/types/streaming';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const sampleStreamingItem: StreamingItem = {
  id: 'video1_prompt1',
  videoId: 'video1',
  videoTitle: 'Test Video Title',
  videoUrl: 'https://youtube.com/watch?v=video1',
  promptId: 'prompt1',
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  content: 'This is streaming content...',
  fullContent: 'This is streaming content...',
  status: 'streaming',
};

describe('StreamingAccordionItem', () => {
  const defaultProps = {
    item: sampleStreamingItem,
    isExpanded: false,
    isCurrentVideo: true,
    onToggle: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
  });

  describe('collapsed state', () => {
    it('should show video title and prompt name', () => {
      render(<StreamingAccordionItem {...defaultProps} />);

      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
      expect(screen.getByText('Prompt: Default Summary')).toBeInTheDocument();
    });

    it('should call onToggle when header is clicked', () => {
      render(<StreamingAccordionItem {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /test video title/i }));

      expect(defaultProps.onToggle).toHaveBeenCalled();
    });
  });

  describe('expanded state', () => {
    it('should show streaming content', () => {
      render(<StreamingAccordionItem {...defaultProps} isExpanded={true} />);

      expect(screen.getByTestId('markdown')).toBeInTheDocument();
      expect(screen.getByTestId('markdown')).toHaveTextContent('This is streaming content...');
    });

    it('should show model name', () => {
      render(<StreamingAccordionItem {...defaultProps} isExpanded={true} />);

      expect(screen.getByText('Model: gpt-4o-mini')).toBeInTheDocument();
    });
  });

  describe('streaming state', () => {
    it('should show cancel button when streaming', () => {
      render(<StreamingAccordionItem {...defaultProps} isExpanded={true} />);

      expect(screen.getByLabelText('Cancel generation')).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<StreamingAccordionItem {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Cancel generation'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
      expect(defaultProps.onToggle).not.toHaveBeenCalled();
    });

    it('should show "Generating..." indicator when streaming', () => {
      render(<StreamingAccordionItem {...defaultProps} isExpanded={true} />);

      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    const errorItem: StreamingItem = {
      ...sampleStreamingItem,
      status: 'error',
      error: 'Failed to connect to API',
    };

    it('should show delete button when in error state', () => {
      render(<StreamingAccordionItem {...defaultProps} item={errorItem} />);

      expect(screen.getByLabelText('Delete')).toBeInTheDocument();
    });

    it('should call onDelete when delete button is clicked', () => {
      render(<StreamingAccordionItem {...defaultProps} item={errorItem} />);

      fireEvent.click(screen.getByLabelText('Delete'));

      expect(defaultProps.onDelete).toHaveBeenCalled();
      expect(defaultProps.onToggle).not.toHaveBeenCalled();
    });

    it('should show error message when expanded', () => {
      render(<StreamingAccordionItem {...defaultProps} item={errorItem} isExpanded={true} />);

      expect(screen.getByText('Failed to connect to API')).toBeInTheDocument();
    });

    it('should show retry button in error state', () => {
      render(<StreamingAccordionItem {...defaultProps} item={errorItem} isExpanded={true} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      render(<StreamingAccordionItem {...defaultProps} item={errorItem} isExpanded={true} />);

      fireEvent.click(screen.getByText('Retry'));

      expect(defaultProps.onRetry).toHaveBeenCalled();
    });

    it('should still show partial content when in error state', () => {
      render(<StreamingAccordionItem {...defaultProps} item={errorItem} isExpanded={true} />);

      expect(screen.getByTestId('markdown')).toHaveTextContent('This is streaming content...');
    });
  });
});
