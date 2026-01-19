import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelSelector } from '../../../src/options/components/ModelSelector';
import type { ModelOption } from '../../../src/types/models';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

// Mock modelsApi
const mockFetchModels = vi.fn();
const mockGetCachedModels = vi.fn();

vi.mock('../../../src/utils/modelsApi', () => ({
  fetchModels: (apiKey: string) => mockFetchModels(apiKey),
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

const sampleModels: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000, pricingDisplay: '$0.15 / $0.60', isFree: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextLength: 200000, pricingDisplay: '$3.00 / $15.00', isFree: false },
];

describe('ModelSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
    mockFetchModels.mockResolvedValue(sampleModels);
    mockGetCachedModels.mockResolvedValue(null);
  });

  it('should show loading state initially', async () => {
    mockFetchModels.mockImplementation(() => new Promise(() => {}));

    render(
      <ModelSelector
        value="openai/gpt-4o-mini"
        onChange={mockOnChange}
        apiKey="test-key"
      />
    );

    expect(screen.getByText('Loading models...')).toBeInTheDocument();
  });

  it('should display selected model after loading', async () => {
    render(
      <ModelSelector
        value="openai/gpt-4o-mini"
        onChange={mockOnChange}
        apiKey="test-key"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    });
  });

  it('should show message when no API key', async () => {
    render(
      <ModelSelector
        value="openai/gpt-4o-mini"
        onChange={mockOnChange}
        apiKey={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Add your API key to see available models')).toBeInTheDocument();
    });
  });

  it('should open dropdown and call onChange on selection', async () => {
    render(
      <ModelSelector
        value="openai/gpt-4o-mini"
        onChange={mockOnChange}
        apiKey="test-key"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Claude 3.5 Sonnet'));

    expect(mockOnChange).toHaveBeenCalledWith('anthropic/claude-3.5-sonnet');
  });

  it('should not open when disabled', async () => {
    render(
      <ModelSelector
        value="openai/gpt-4o-mini"
        onChange={mockOnChange}
        apiKey="test-key"
        disabled
      />
    );

    await waitFor(() => {
      expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
  });
});
