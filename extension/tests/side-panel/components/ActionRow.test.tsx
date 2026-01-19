import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionRow } from '../../../src/side-panel/components/ActionRow';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

// Mock PromptSelector - onChange now takes (promptId, modelId)
vi.mock('../../../src/side-panel/components/PromptSelector', () => ({
  PromptSelector: ({ value, onChange }: { value: string; onChange: (promptId: string, modelId: string) => void }) => (
    <select
      data-testid="prompt-selector"
      value={value}
      onChange={(e) => onChange(e.target.value, 'openai/gpt-4o-mini')}
    >
      <option value="prompt1">Prompt 1</option>
      <option value="prompt2">Prompt 2</option>
    </select>
  ),
}));

// Mock CompactModelSelector
vi.mock('../../../src/side-panel/components/CompactModelSelector', () => ({
  CompactModelSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="model-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
      <option value="openai/gpt-4o">GPT-4o</option>
    </select>
  ),
}));

// Mock CopyButton
vi.mock('../../../src/side-panel/components/CopyButton', () => ({
  CopyButton: ({ content, variant }: { content: string; variant?: string }) => (
    <button data-testid="copy-button" data-content={content} data-variant={variant}>
      Copy
    </button>
  ),
}));

// Mock PromptEditorSection component
vi.mock('../../../src/side-panel/components/PromptEditorSection', () => ({
  PromptEditorSection: () => <div data-testid="prompt-editor-section">Editor Section</div>,
}));

describe('ActionRow', () => {
  const defaultProps = {
    selectedPromptId: 'prompt1',
    selectedModelId: 'openai/gpt-4o-mini',
    onPromptChange: vi.fn(),
    onModelChange: vi.fn(),
    onRegenerate: vi.fn(),
    onRegenerateWithCustomPrompt: vi.fn(),
    onRegenerateWithNewPrompt: vi.fn(),
    content: 'Test summary content',
    videoTitle: 'Test Video',
    videoUrl: 'https://www.youtube.com/watch?v=abc123',
    apiKey: 'test-api-key',
    showSelectors: true,
    customPromptText: undefined,
  };

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
  });

  describe('selectors', () => {
    it('should render prompt selector with correct value', () => {
      render(<ActionRow {...defaultProps} />);

      expect(screen.getByTestId('prompt-selector')).toHaveValue('prompt1');
    });

    it('should render model selector with correct value', () => {
      render(<ActionRow {...defaultProps} />);

      expect(screen.getByTestId('model-selector')).toHaveValue('openai/gpt-4o-mini');
    });

    it('should call onPromptChange when prompt is changed with promptId and modelId', () => {
      render(<ActionRow {...defaultProps} />);

      fireEvent.change(screen.getByTestId('prompt-selector'), { target: { value: 'prompt2' } });

      expect(defaultProps.onPromptChange).toHaveBeenCalledWith('prompt2', 'openai/gpt-4o-mini');
    });

    it('should call onModelChange when model is changed', () => {
      render(<ActionRow {...defaultProps} />);

      fireEvent.change(screen.getByTestId('model-selector'), { target: { value: 'openai/gpt-4o' } });

      expect(defaultProps.onModelChange).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('should hide selectors when showSelectors is false', () => {
      render(<ActionRow {...defaultProps} showSelectors={false} />);

      expect(screen.queryByTestId('prompt-selector')).not.toBeInTheDocument();
      expect(screen.queryByTestId('model-selector')).not.toBeInTheDocument();
    });

    it('should show selectors when showSelectors is true', () => {
      render(<ActionRow {...defaultProps} showSelectors={true} />);

      expect(screen.getByTestId('prompt-selector')).toBeInTheDocument();
      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    });
  });

  describe('copy button', () => {
    it('should show copy button when no error', () => {
      render(<ActionRow {...defaultProps} />);

      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
    });

    it('should hide copy button when hasError is true', () => {
      render(<ActionRow {...defaultProps} hasError={true} />);

      expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument();
    });

    it('should pass content to CopyButton', () => {
      render(<ActionRow {...defaultProps} content="My test content" />);

      expect(screen.getByTestId('copy-button')).toHaveAttribute('data-content', 'My test content');
    });

    it('should use icon variant for CopyButton', () => {
      render(<ActionRow {...defaultProps} />);

      // Icon variant is the default, so no variant attribute should be set
      expect(screen.getByTestId('copy-button')).not.toHaveAttribute('data-variant', 'text');
    });

    it('should show copy button for history items', () => {
      render(<ActionRow {...defaultProps} showSelectors={false} />);

      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
    });
  });

  describe('regenerate button', () => {
    it('should show regenerate button when showSelectors is true and no error', () => {
      render(<ActionRow {...defaultProps} showSelectors={true} />);

      expect(screen.getByLabelText('Regenerate')).toBeInTheDocument();
    });

    it('should hide regenerate button when showSelectors is false', () => {
      render(<ActionRow {...defaultProps} showSelectors={false} />);

      expect(screen.queryByLabelText('Regenerate')).not.toBeInTheDocument();
    });

    it('should hide regenerate button when hasError is true', () => {
      render(<ActionRow {...defaultProps} showSelectors={true} hasError={true} />);

      expect(screen.queryByLabelText('Regenerate')).not.toBeInTheDocument();
    });

    it('should call onRegenerate when regenerate button is clicked', () => {
      const onRegenerate = vi.fn();
      render(<ActionRow {...defaultProps} onRegenerate={onRegenerate} showSelectors={true} />);

      fireEvent.click(screen.getByLabelText('Regenerate'));

      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('model name display for history items', () => {
    it('should show model name when showSelectors is false', () => {
      render(<ActionRow {...defaultProps} showSelectors={false} selectedModelId="openai/gpt-4o-mini" />);

      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    });

    it('should not show model name when showSelectors is true', () => {
      render(<ActionRow {...defaultProps} showSelectors={true} selectedModelId="openai/gpt-4o-mini" />);

      // Model name should not appear as text (only in selector)
      expect(screen.queryByText('gpt-4o-mini')).not.toBeInTheDocument();
    });

    it('should extract model name from full ID', () => {
      render(<ActionRow {...defaultProps} showSelectors={false} selectedModelId="anthropic/claude-3.5-sonnet" />);

      expect(screen.getByText('claude-3.5-sonnet')).toBeInTheDocument();
    });
  });
});
