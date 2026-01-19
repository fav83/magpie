import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneratePanel } from '../../../src/side-panel/components/GeneratePanel';

// Mock useChromeStorage
vi.mock('../../../src/hooks/useChromeStorage', () => ({
  useChromeStorage: () => ['test-api-key'],
}));

// Mock promptStorage
const mockGetDefaultPromptId = vi.fn().mockResolvedValue('default-prompt');
const mockGetPromptById = vi.fn().mockResolvedValue({
  id: 'default-prompt',
  name: 'Default Summary',
  text: 'Summarize this video',
  model: 'openai/gpt-4o-mini',
});
const mockGetDefaultPromptAndModel = vi.fn().mockResolvedValue({
  promptId: 'default-prompt',
  modelId: 'openai/gpt-4o-mini',
});

vi.mock('../../../src/utils/promptStorage', () => ({
  getDefaultPromptId: () => mockGetDefaultPromptId(),
  getPromptById: (id: string) => mockGetPromptById(id),
  getDefaultPromptAndModel: () => mockGetDefaultPromptAndModel(),
}));

// Mock PromptSelector
vi.mock('../../../src/side-panel/components/PromptSelector', () => ({
  PromptSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (promptId: string, modelId: string) => void;
  }) => (
    <select
      data-testid="prompt-selector"
      value={value}
      onChange={(e) => onChange(e.target.value, 'openai/gpt-4o-mini')}
    >
      <option value="default-prompt">Default Summary</option>
      <option value="other-prompt">Other Prompt</option>
    </select>
  ),
}));

// Mock CompactModelSelector
vi.mock('../../../src/side-panel/components/CompactModelSelector', () => ({
  CompactModelSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (modelId: string) => void;
  }) => (
    <select
      data-testid="model-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
      <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
    </select>
  ),
}));

describe('GeneratePanel', () => {
  const mockOnGenerate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    render(<GeneratePanel onGenerate={mockOnGenerate} />);

    // Should show the placeholder div while loading
    expect(screen.queryByText('Generate Summary')).not.toBeInTheDocument();
  });

  it('should render selectors and button after initialization', async () => {
    render(<GeneratePanel onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    expect(screen.getByTestId('prompt-selector')).toBeInTheDocument();
    expect(screen.getByTestId('model-selector')).toBeInTheDocument();
  });

  it('should call onGenerate with selected prompt and model when button is clicked', async () => {
    render(<GeneratePanel onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Generate Summary'));

    expect(mockOnGenerate).toHaveBeenCalledWith('default-prompt', 'openai/gpt-4o-mini');
  });

  it('should update model when prompt changes', async () => {
    render(<GeneratePanel onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    // Change prompt
    fireEvent.change(screen.getByTestId('prompt-selector'), {
      target: { value: 'other-prompt' },
    });

    // Click generate
    fireEvent.click(screen.getByText('Generate Summary'));

    expect(mockOnGenerate).toHaveBeenCalledWith('other-prompt', 'openai/gpt-4o-mini');
  });

  it('should update model independently', async () => {
    render(<GeneratePanel onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    // Change model
    fireEvent.change(screen.getByTestId('model-selector'), {
      target: { value: 'anthropic/claude-3-haiku' },
    });

    // Click generate
    fireEvent.click(screen.getByText('Generate Summary'));

    expect(mockOnGenerate).toHaveBeenCalledWith('default-prompt', 'anthropic/claude-3-haiku');
  });

  it('should load default prompt and model on mount', async () => {
    render(<GeneratePanel onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      expect(mockGetDefaultPromptAndModel).toHaveBeenCalled();
    });
  });
});
