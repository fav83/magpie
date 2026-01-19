import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useModelSelector } from '../../src/hooks/useModelSelector';
import type { ModelOption } from '../../src/types/models';
import { setupChromeMock, resetChromeMock, chromeMock } from '../mocks/chrome';
import { STORAGE_KEYS } from '../../src/config';

// Mock modelsApi
const mockFetchModels = vi.fn();
const mockGetCachedModels = vi.fn();
vi.mock('../../src/utils/modelsApi', () => ({
  fetchModels: () => mockFetchModels(),
  getCachedModels: () => mockGetCachedModels(),
}));

// Mock preferredModelsStorage
const mockGetPreferredModelIds = vi.fn();
const mockTogglePreferredModel = vi.fn();
vi.mock('../../src/utils/preferredModelsStorage', () => ({
  getPreferredModelIds: () => mockGetPreferredModelIds(),
  togglePreferredModel: (id: string) => mockTogglePreferredModel(id),
}));

// Mock freeFilterStorage
const mockGetShowFreeOnly = vi.fn();
const mockSetShowFreeOnly = vi.fn();
vi.mock('../../src/utils/freeFilterStorage', () => ({
  getShowFreeOnly: () => mockGetShowFreeOnly(),
  setShowFreeOnly: (_location: string, value: boolean) => mockSetShowFreeOnly(value),
}));

const sampleModels: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', pricingDisplay: '$0.15 / $0.60', contextLength: 128000, isFree: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', pricingDisplay: '$0.25 / $0.75', contextLength: 200000, isFree: false },
  { id: 'google/gemini-flash', name: 'Gemini Flash', pricingDisplay: '$0.10 / $0.30', contextLength: 1000000, isFree: false },
];

describe('useModelSelector', () => {
  const defaultProps: {
    value: string;
    onChange: ReturnType<typeof vi.fn>;
    apiKey: string | null;
    filterLocation: 'options' | 'sidebar';
  } = {
    value: 'openai/gpt-4o-mini',
    onChange: vi.fn(),
    apiKey: 'sk-or-test-key',
    filterLocation: 'options',
  };

  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.clearAllMocks();
    mockFetchModels.mockResolvedValue(sampleModels);
    mockGetCachedModels.mockResolvedValue(null);
    mockGetPreferredModelIds.mockResolvedValue([]);
    mockTogglePreferredModel.mockResolvedValue(undefined);
    mockGetShowFreeOnly.mockResolvedValue(false);
    mockSetShowFreeOnly.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should initialize with empty models and loading state', () => {
      mockFetchModels.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useModelSelector(defaultProps));

      expect(result.current.models).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.search).toBe('');
      expect(result.current.error).toBeNull();
    });

    it('should load models when apiKey is provided', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockFetchModels).toHaveBeenCalled();
    });

    it('should not fetch models when apiKey is null', async () => {
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, apiKey: null })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchModels).not.toHaveBeenCalled();
      expect(result.current.models).toEqual([]);
    });

    it('should set error when apiKey is null and trackStaleState is true', async () => {
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, apiKey: null, trackStaleState: true })
      );

      expect(result.current.error).toBe('Add your API key to see available models');
    });

    it('should reset state when apiKey changes to null', async () => {
      const { result, rerender } = renderHook(
        (props) => useModelSelector(props),
        { initialProps: defaultProps }
      );

      // Wait for models to load
      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Change apiKey to null
      rerender({ ...defaultProps, apiKey: null });

      // State should be reset
      expect(result.current.models).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStale).toBe(false);
    });

    it('should set error when apiKey changes to null with trackStaleState', async () => {
      const { result, rerender } = renderHook(
        (props) => useModelSelector(props),
        { initialProps: { ...defaultProps, trackStaleState: true } }
      );

      // Wait for models to load
      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      // Change apiKey to null
      rerender({ ...defaultProps, apiKey: null, trackStaleState: true });

      // Should show error message
      expect(result.current.error).toBe('Add your API key to see available models');
      expect(result.current.models).toEqual([]);
    });
  });

  describe('selectedModel', () => {
    it('should find selected model from models list', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.selectedModel).toBeDefined();
      });

      expect(result.current.selectedModel?.id).toBe('openai/gpt-4o-mini');
      expect(result.current.selectedModel?.name).toBe('GPT-4o Mini');
    });

    it('should return undefined when value not in models', async () => {
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, value: 'unknown-model' })
      );

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      expect(result.current.selectedModel).toBeUndefined();
    });
  });

  describe('filtering', () => {
    it('should filter models by search term', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setSearch('claude');
      });

      expect(result.current.filteredModels).toHaveLength(1);
      expect(result.current.filteredModels[0]?.name).toBe('Claude 3 Haiku');
    });

    it('should filter by model ID', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setSearch('openai');
      });

      expect(result.current.filteredModels).toHaveLength(1);
      expect(result.current.filteredModels[0]?.id).toBe('openai/gpt-4o-mini');
    });

    it('should be case insensitive', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setSearch('GEMINI');
      });

      expect(result.current.filteredModels).toHaveLength(1);
      expect(result.current.filteredModels[0]?.name).toBe('Gemini Flash');
    });

    it('should return all models when search is empty', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      expect(result.current.filteredModels).toHaveLength(3);
    });
  });

  describe('handleSelect', () => {
    it('should call onChange with selected model ID', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, onChange })
      );

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.handleSelect('anthropic/claude-3-haiku');
      });

      expect(onChange).toHaveBeenCalledWith('anthropic/claude-3-haiku');
    });

    it('should close dropdown after selection', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setIsOpen(true);
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleSelect('anthropic/claude-3-haiku');
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should clear search after selection', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setSearch('claude');
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.handleSelect('anthropic/claude-3-haiku');
      });

      expect(result.current.search).toBe('');
    });
  });

  describe('handleKeyDown', () => {
    it('should close dropdown on Escape', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setIsOpen(true);
        result.current.setSearch('test');
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Escape' } as React.KeyboardEvent);
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.search).toBe('');
    });

    it('should select first filtered model on Enter', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, onChange })
      );

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setSearch('claude');
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent);
      });

      expect(onChange).toHaveBeenCalledWith('anthropic/claude-3-haiku');
    });

    it('should not select on Enter when no filtered models', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, onChange })
      );

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setSearch('nonexistent');
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should ignore other keys', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, onChange })
      );

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      act(() => {
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Tab' } as React.KeyboardEvent);
      });

      expect(result.current.isOpen).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('error handling and stale state', () => {
    it('should use cached models when fetch fails', async () => {
      mockFetchModels.mockRejectedValue(new Error('Network error'));
      mockGetCachedModels.mockResolvedValue([sampleModels[0]]);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(1);
      });

      expect(result.current.models[0]?.id).toBe('openai/gpt-4o-mini');
    });

    it('should set isStale when using cached models and trackStaleState is true', async () => {
      mockFetchModels.mockRejectedValue(new Error('Network error'));
      mockGetCachedModels.mockResolvedValue([sampleModels[0]]);

      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, trackStaleState: true })
      );

      await waitFor(() => {
        expect(result.current.isStale).toBe(true);
      });
    });

    it('should not set isStale when trackStaleState is false', async () => {
      mockFetchModels.mockRejectedValue(new Error('Network error'));
      mockGetCachedModels.mockResolvedValue([sampleModels[0]]);

      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, trackStaleState: false })
      );

      await waitFor(() => {
        expect(result.current.models).toHaveLength(1);
      });

      expect(result.current.isStale).toBe(false);
    });

    it('should set error when fetch fails and no cache and trackStaleState is true', async () => {
      mockFetchModels.mockRejectedValue(new Error('Network error'));
      mockGetCachedModels.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useModelSelector({ ...defaultProps, trackStaleState: true })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Could not load models');
      });
    });
  });

  describe('refs', () => {
    it('should provide containerRef', () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.containerRef.current).toBeNull(); // Not attached to DOM in test
    });

    it('should provide inputRef', () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      expect(result.current.inputRef).toBeDefined();
      expect(result.current.inputRef.current).toBeNull();
    });
  });

  describe('preferred models', () => {
    it('should initialize with empty preferred models', async () => {
      mockGetPreferredModelIds.mockResolvedValue([]);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      expect(result.current.preferredIds.size).toBe(0);
      expect(result.current.preferredModels).toHaveLength(0);
      expect(result.current.nonPreferredModels).toHaveLength(3);
    });

    it('should separate preferred and non-preferred models', async () => {
      mockGetPreferredModelIds.mockResolvedValue(['openai/gpt-4o-mini']);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      await waitFor(() => {
        expect(result.current.preferredIds.size).toBe(1);
      });

      expect(result.current.preferredModels).toHaveLength(1);
      expect(result.current.preferredModels[0]?.id).toBe('openai/gpt-4o-mini');
      expect(result.current.nonPreferredModels).toHaveLength(2);
    });

    it('should sort preferred models alphabetically', async () => {
      mockGetPreferredModelIds.mockResolvedValue([
        'openai/gpt-4o-mini',
        'anthropic/claude-3-haiku',
      ]);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.preferredModels).toHaveLength(2);
      });

      // Claude 3 Haiku comes before GPT-4o Mini alphabetically
      expect(result.current.preferredModels[0]?.name).toBe('Claude 3 Haiku');
      expect(result.current.preferredModels[1]?.name).toBe('GPT-4o Mini');
    });

    it('should sort non-preferred models alphabetically', async () => {
      mockGetPreferredModelIds.mockResolvedValue([]);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.nonPreferredModels).toHaveLength(3);
      });

      expect(result.current.nonPreferredModels[0]?.name).toBe('Claude 3 Haiku');
      expect(result.current.nonPreferredModels[1]?.name).toBe('Gemini Flash');
      expect(result.current.nonPreferredModels[2]?.name).toBe('GPT-4o Mini');
    });

    it('should identify unavailable preferred models', async () => {
      mockGetPreferredModelIds.mockResolvedValue([
        'openai/gpt-4o-mini',
        'some-unavailable/model',
      ]);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      await waitFor(() => {
        expect(result.current.unavailablePreferred).toHaveLength(1);
      });

      expect(result.current.unavailablePreferred[0]).toBe('some-unavailable/model');
    });

    it('should call togglePreferredModel when togglePreferred is called', async () => {
      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      await act(async () => {
        await result.current.togglePreferred('openai/gpt-4o-mini');
      });

      expect(mockTogglePreferredModel).toHaveBeenCalledWith('openai/gpt-4o-mini');
    });

    it('should update preferredIds when storage changes', async () => {
      mockGetPreferredModelIds.mockResolvedValue([]);

      const { result } = renderHook(() => useModelSelector(defaultProps));

      await waitFor(() => {
        expect(result.current.preferredIds.size).toBe(0);
      });

      // Simulate storage change
      act(() => {
        const listeners = chromeMock.storage.local.onChanged.addListener.mock.calls;
        for (const [listener] of listeners) {
          if (typeof listener === 'function') {
            listener({
              [STORAGE_KEYS.PREFERRED_MODELS]: {
                newValue: ['anthropic/claude-3-haiku'],
              },
            });
          }
        }
      });

      expect(result.current.preferredIds.has('anthropic/claude-3-haiku')).toBe(true);
    });
  });
});
