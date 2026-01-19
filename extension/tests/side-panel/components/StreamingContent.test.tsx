import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingContent } from '../../../src/side-panel/components/StreamingContent';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock useFontSize
vi.mock('../../../src/hooks/useFontSize', () => ({
  useFontSize: () => 12,
}));

describe('StreamingContent', () => {
  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
  });

  describe('with content', () => {
    it('should render content with ReactMarkdown', () => {
      render(<StreamingContent content="Test markdown content" isStreaming={false} />);

      expect(screen.getByTestId('markdown')).toBeInTheDocument();
      expect(screen.getByTestId('markdown')).toHaveTextContent('Test markdown content');
    });

    it('should show streaming cursor when streaming', () => {
      render(<StreamingContent content="Some content" isStreaming={true} />);

      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should not show streaming cursor when not streaming', () => {
      render(<StreamingContent content="Some content" isStreaming={false} />);

      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should have streaming-cursor class on cursor', () => {
      render(<StreamingContent content="Some content" isStreaming={true} />);

      const cursor = screen.getByText('▊');
      expect(cursor).toHaveClass('streaming-cursor');
    });
  });

  describe('without content', () => {
    it('should show only cursor when streaming with no content', () => {
      render(<StreamingContent content="" isStreaming={true} />);

      expect(screen.getByText('▊')).toBeInTheDocument();
      expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    });

    it('should show "No content" when not streaming and no content', () => {
      render(<StreamingContent content="" isStreaming={false} />);

      expect(screen.getByText('No content')).toBeInTheDocument();
    });

    it('should have italic styling for "No content"', () => {
      render(<StreamingContent content="" isStreaming={false} />);

      const noContent = screen.getByText('No content');
      expect(noContent).toHaveClass('italic', 'text-gray-400');
    });

    it('should have gray text for streaming placeholder', () => {
      const { container } = render(<StreamingContent content="" isStreaming={true} />);

      const placeholder = container.querySelector('.text-gray-500');
      expect(placeholder).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have proper container classes', () => {
      const { container } = render(<StreamingContent content="Test" isStreaming={false} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('text-gray-800', 'leading-relaxed', 'markdown-content', 'rounded-md');
    });

    it('should apply font size from storage', () => {
      const { container } = render(<StreamingContent content="Test" isStreaming={false} />);

      const wrapper = container.firstChild as HTMLElement;
      // Default font size is 12
      expect(wrapper.style.fontSize).toBe('12px');
    });
  });

  describe('markdown rendering', () => {
    it('should render multiline content', () => {
      const content = 'Line 1\n\nLine 2\n\nLine 3';
      render(<StreamingContent content={content} isStreaming={false} />);

      expect(screen.getByTestId('markdown')).toHaveTextContent('Line 1');
      expect(screen.getByTestId('markdown')).toHaveTextContent('Line 2');
      expect(screen.getByTestId('markdown')).toHaveTextContent('Line 3');
    });

    it('should handle special characters in content', () => {
      const content = 'Code: `const x = 1;` and **bold** text';
      render(<StreamingContent content={content} isStreaming={false} />);

      expect(screen.getByTestId('markdown')).toHaveTextContent(content);
    });
  });
});
