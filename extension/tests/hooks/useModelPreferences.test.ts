import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useModelPreferences } from '../../src/hooks/useModelPreferences';

// Mock the storage utilities
const mockGetPreferredModelIds = vi.fn().mockResolvedValue([]);
const mockTogglePreferredModel = vi.fn().mockResolvedValue(undefined);
const mockGetShowFreeOnly = vi.fn().mockResolvedValue(false);
const mockSetShowFreeOnly = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/utils/preferredModelsStorage', () => ({
  getPreferredModelIds: () => mockGetPreferredModelIds(),
  togglePreferredModel: (modelId: string) => mockTogglePreferredModel(modelId),
}));

vi.mock('../../src/utils/freeFilterStorage', () => ({
  getShowFreeOnly: (location: string) => mockGetShowFreeOnly(location),
  setShowFreeOnly: (location: string, value: boolean) => mockSetShowFreeOnly(location, value),
}));

describe('useModelPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferredModelIds.mockResolvedValue([]);
    mockGetShowFreeOnly.mockResolvedValue(false);
  });

  it('should load preferred models and free filter on mount', async () => {
    mockGetPreferredModelIds.mockResolvedValue(['model-1', 'model-2']);
    mockGetShowFreeOnly.mockResolvedValue(true);

    const { result } = renderHook(() => useModelPreferences({ filterLocation: 'options' }));

    await waitFor(() => {
      expect(result.current.preferredIds.has('model-1')).toBe(true);
      expect(result.current.preferredIds.has('model-2')).toBe(true);
      expect(result.current.showFreeOnly).toBe(true);
    });
  });

  it('should call togglePreferred with model ID', async () => {
    const { result } = renderHook(() => useModelPreferences({ filterLocation: 'options' }));

    await act(async () => {
      await result.current.togglePreferred('model-1');
    });

    expect(mockTogglePreferredModel).toHaveBeenCalledWith('model-1');
  });

  it('should use correct filterLocation for free filter operations', async () => {
    const { result } = renderHook(() => useModelPreferences({ filterLocation: 'sidebar' }));

    await act(async () => {
      await result.current.setShowFreeOnly(true);
    });

    expect(mockSetShowFreeOnly).toHaveBeenCalledWith('sidebar', true);
  });
});
