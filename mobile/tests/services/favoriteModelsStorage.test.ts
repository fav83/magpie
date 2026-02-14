import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();
const mockGet = vi.fn();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: (...args: unknown[]) => mockSet(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import {
  getFavoriteModelIds,
  saveFavoriteModelIds,
  addFavoriteModel,
  removeFavoriteModel,
  toggleFavoriteModel,
  initializeDefaultFavorites,
} from '../../src/services/favoriteModelsStorage';

beforeEach(() => {
  mockSet.mockReset();
  mockGet.mockReset();
  mockSet.mockResolvedValue(undefined);
});

describe('getFavoriteModelIds', () => {
  it('returns parsed array when stored', async () => {
    mockGet.mockResolvedValue({ value: '["model-a","model-b"]' });

    const result = await getFavoriteModelIds();

    expect(result).toEqual(['model-a', 'model-b']);
    expect(mockGet).toHaveBeenCalledWith({ key: 'favorite_model_ids' });
  });

  it('returns empty array when nothing stored', async () => {
    mockGet.mockResolvedValue({ value: null });

    const result = await getFavoriteModelIds();

    expect(result).toEqual([]);
  });

  it('returns empty array when Preferences.get throws', async () => {
    mockGet.mockRejectedValue(new Error('Storage unavailable'));

    const result = await getFavoriteModelIds();

    expect(result).toEqual([]);
  });
});

describe('saveFavoriteModelIds', () => {
  it('saves JSON array to Preferences', async () => {
    await saveFavoriteModelIds(['model-a', 'model-b']);

    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_model_ids',
      value: '["model-a","model-b"]',
    });
  });

  it('does not throw when Preferences.set throws', async () => {
    mockSet.mockRejectedValue(new Error('Storage full'));

    await expect(saveFavoriteModelIds(['model-a'])).resolves.toBeUndefined();
  });
});

describe('addFavoriteModel', () => {
  it('appends new model ID to existing favorites', async () => {
    mockGet.mockResolvedValue({ value: '["model-a"]' });

    await addFavoriteModel('model-b');

    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_model_ids',
      value: '["model-a","model-b"]',
    });
  });

  it('does not duplicate an already-favorited model', async () => {
    mockGet.mockResolvedValue({ value: '["model-a"]' });

    await addFavoriteModel('model-a');

    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('removeFavoriteModel', () => {
  it('removes model ID from favorites', async () => {
    mockGet.mockResolvedValue({ value: '["model-a","model-b"]' });

    await removeFavoriteModel('model-a');

    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_model_ids',
      value: '["model-b"]',
    });
  });

  it('is a no-op when model is not in favorites', async () => {
    mockGet.mockResolvedValue({ value: '["model-a"]' });

    await removeFavoriteModel('model-z');

    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_model_ids',
      value: '["model-a"]',
    });
  });
});

describe('toggleFavoriteModel', () => {
  it('adds model and returns true when not favorited', async () => {
    mockGet.mockResolvedValue({ value: '["model-a"]' });

    const result = await toggleFavoriteModel('model-b');

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_model_ids',
      value: '["model-a","model-b"]',
    });
  });

  it('removes model and returns false when already favorited', async () => {
    mockGet.mockResolvedValue({ value: '["model-a","model-b"]' });

    const result = await toggleFavoriteModel('model-a');

    expect(result).toBe(false);
    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_model_ids',
      value: '["model-b"]',
    });
  });
});

describe('initializeDefaultFavorites', () => {
  it('populates favorites from defaultPrompts.json on first run', async () => {
    // First call: check initialized flag → not set
    // Second call: getFavoriteModelIds inside saveFavoriteModelIds (not called directly)
    mockGet.mockResolvedValue({ value: null });

    await initializeDefaultFavorites();

    // Should set the initialized flag
    expect(mockSet).toHaveBeenCalledWith({
      key: 'favorite_models_initialized',
      value: 'true',
    });

    // Should save unique model IDs from defaultPrompts.json
    const saveCall = mockSet.mock.calls.find(
      (call) => (call[0] as { key: string }).key === 'favorite_model_ids',
    );
    expect(saveCall).toBeDefined();
    const savedIds: string[] = JSON.parse((saveCall![0] as { value: string }).value);
    expect(savedIds).toContain('openai/gpt-4o-mini');
    expect(savedIds).toContain('google/gemini-2.0-flash-001');
    expect(savedIds).toContain('google/gemini-2.0-flash-lite-001');
    expect(savedIds).toContain('anthropic/claude-3.5-haiku');
    // Should be deduplicated
    expect(new Set(savedIds).size).toBe(savedIds.length);
  });

  it('skips initialization when already initialized', async () => {
    mockGet.mockResolvedValue({ value: 'true' });

    await initializeDefaultFavorites();

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not throw when Preferences throws', async () => {
    mockGet.mockRejectedValue(new Error('Storage unavailable'));

    await expect(initializeDefaultFavorites()).resolves.toBeUndefined();
  });
});
