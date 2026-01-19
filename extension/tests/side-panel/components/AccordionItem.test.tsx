import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccordionItem } from '../../../src/side-panel/components/AccordionItem';
import type { AccordionItem as AccordionItemType } from '../../../src/types/accordion';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock useChromeStorage
vi.mock('../../../src/hooks/useChromeStorage', () => ({
  useChromeStorage: () => ['test-api-key', vi.fn(), false],
}));

// Mock PromptSelector
vi.mock('../../../src/side-panel/components/PromptSelector', () => ({
  PromptSelector: ({ value, onChange, disabled }: { value: string; onChange: (promptId: string, modelId: string) => void; disabled: boolean }) => (
    <select
      data-testid="prompt-selector"
      value={value}
      onChange={(e) => onChange(e.target.value, 'openai/gpt-4o-mini')}
      disabled={disabled}
    >
      <option value="prompt1">Prompt 1</option>
      <option value="prompt2">Prompt 2</option>
    </select>
  ),
}));

// Mock CompactModelSelector
vi.mock('../../../src/side-panel/components/CompactModelSelector', () => ({
  CompactModelSelector: ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) => (
    <select
      data-testid="model-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
      <option value="openai/gpt-4o">GPT-4o</option>
    </select>
  ),
}));

const sampleItem: AccordionItemType = {
  id: 'video1_prompt1',
  videoId: 'video1',
  videoTitle: 'Test Video Title',
  videoUrl: 'https://youtube.com/watch?v=video1',
  promptId: 'prompt1',
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  summary: 'This is a test summary with **markdown**.',
  timestamp: Date.now() - 60000,
};

// Mock ChatSection
vi.mock('../../../src/side-panel/components/chat', () => ({
  ChatSection: () => <div data-testid="chat-section">Chat</div>,
}));

describe('AccordionItem', () => {
  const defaultProps = {
    item: sampleItem,
    isCurrentVideo: false,
    currentTabId: 123 as number | null,
    isExpanded: false,
    onToggle: vi.fn(),
    onDelete: vi.fn() as (() => void) | undefined,
    onRegenerate: vi.fn(),
    onRetry: vi.fn() as (() => void) | undefined,
    error: undefined as string | undefined,
  };

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
  });

  describe('collapsed state', () => {
    it('should show video title and prompt name', () => {
      render(<AccordionItem {...defaultProps} />);

      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
      expect(screen.getByText('Prompt: Default Summary')).toBeInTheDocument();
    });

    it('should call onToggle when header is clicked', () => {
      render(<AccordionItem {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /test video title/i }));

      expect(defaultProps.onToggle).toHaveBeenCalled();
    });

    it('should show delete button when onDelete is provided', () => {
      render(<AccordionItem {...defaultProps} />);

      expect(screen.getByLabelText('Delete summary')).toBeInTheDocument();
    });

    it('should call onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      render(<AccordionItem {...defaultProps} onDelete={onDelete} />);

      fireEvent.click(screen.getByLabelText('Delete summary'));

      expect(onDelete).toHaveBeenCalled();
      expect(defaultProps.onToggle).not.toHaveBeenCalled();
    });
  });

  describe('expanded state', () => {
    it('should show summary content', () => {
      render(<AccordionItem {...defaultProps} isExpanded={true} />);

      expect(screen.getByTestId('markdown')).toBeInTheDocument();
      expect(screen.getByTestId('markdown')).toHaveTextContent('This is a test summary');
    });

    it('should show selectors for current video', () => {
      render(<AccordionItem {...defaultProps} isExpanded={true} isCurrentVideo={true} />);

      expect(screen.getByTestId('prompt-selector')).toBeInTheDocument();
      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    });

    it('should hide selectors for history items', () => {
      render(<AccordionItem {...defaultProps} isExpanded={true} isCurrentVideo={false} />);

      expect(screen.queryByTestId('model-selector')).not.toBeInTheDocument();
      expect(screen.queryByTestId('prompt-selector')).not.toBeInTheDocument();
    });

    it('should call onRegenerate when prompt is changed', () => {
      render(<AccordionItem {...defaultProps} isExpanded={true} isCurrentVideo={true} />);

      fireEvent.change(screen.getByTestId('prompt-selector'), { target: { value: 'prompt2' } });

      expect(defaultProps.onRegenerate).toHaveBeenCalledWith('prompt2', 'openai/gpt-4o-mini');
    });

    it('should call onRegenerate when model is changed', () => {
      render(<AccordionItem {...defaultProps} isExpanded={true} isCurrentVideo={true} />);

      fireEvent.change(screen.getByTestId('model-selector'), { target: { value: 'openai/gpt-4o' } });

      expect(defaultProps.onRegenerate).toHaveBeenCalledWith('prompt1', 'openai/gpt-4o');
    });
  });

  describe('error state', () => {
    it('should show error message when error is set', () => {
      render(
        <AccordionItem
          {...defaultProps}
          isExpanded={true}
          error="Failed to connect to API"
        />
      );

      expect(screen.getByText('Failed to connect to API')).toBeInTheDocument();
    });

    it('should show retry button when error and onRetry provided', () => {
      const onRetry = vi.fn();
      render(
        <AccordionItem
          {...defaultProps}
          isExpanded={true}
          error="Some error"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    it('should hide summary content when error is shown', () => {
      render(
        <AccordionItem
          {...defaultProps}
          isExpanded={true}
          error="Some error"
        />
      );

      expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    });
  });
});
