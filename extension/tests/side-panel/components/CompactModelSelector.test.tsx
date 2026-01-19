import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompactModelSelector } from '../../../src/side-panel/components/CompactModelSelector';
import type { ModelOption } from '../../../src/types/models';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

// Mock modelsApi
const mockFetchModels = vi.fn();
const mockGetCachedModels = vi.fn();
vi.mock('../../../src/utils/modelsApi', () => ({
  fetchModels: () => mockFetchModels(),
  getCachedModels: () => mockGetCachedModels(),
}));

// Mock preferredModelsStorage
vi.mock('../../../src/utils/preferredModelsStorage', () => ({
  getPreferredModelIds: () => Promise.resolve([]),
  togglePreferredModel: () => Promise.resolve(),
}));

// Mock freeFilterStorage
vi.mock('../../../src/utils/freeFilterStorage', () => ({
  getShowFreeOnly: () => Promise.resolve(false),
  setShowFreeOnly: () => Promise.resolve(),
}));

const defaultModels: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', pricingDisplay: '$0.15/M', contextLength: 128000, isFree: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', pricingDisplay: '$0.25/M', contextLength: 200000, isFree: false },
];

describe('CompactModelSelector', () => {
  const defaultProps = {
    value: 'openai/gpt-4o-mini',
    onChange: vi.fn(),
    apiKey: 'sk-or-test-key',
  };

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
    mockFetchModels.mockResolvedValue(defaultModels);
    mockGetCachedModels.mockResolvedValue(null);
  });

  it('should render model name button', async () => {
    render(<CompactModelSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    });
  });

  it('should show "No API key" when apiKey is null', () => {
    render(<CompactModelSelector {...defaultProps} apiKey={null} />);

    expect(screen.getByText('No API key')).toBeInTheDocument();
  });

  it('should show "Loading..." while fetching models', async () => {
    mockFetchModels.mockImplementation(() => new Promise(() => {}));

    render(<CompactModelSelector {...defaultProps} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should call onChange when a model is selected', async () => {
    const onChange = vi.fn();
    render(<CompactModelSelector {...defaultProps} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /GPT-4o Mini/i }));

    await waitFor(() => {
      expect(screen.getByText('Claude 3 Haiku')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Claude 3 Haiku'));

    expect(onChange).toHaveBeenCalledWith('anthropic/claude-3-haiku');
  });

  it('should not open when disabled', async () => {
    render(<CompactModelSelector {...defaultProps} disabled={true} />);

    await waitFor(() => {
      expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /GPT-4o Mini/i });
    fireEvent.click(button);

    expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
  });
});
