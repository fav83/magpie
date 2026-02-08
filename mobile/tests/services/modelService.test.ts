import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config', () => ({
  config: {
    openrouter: {
      apiUrl: 'https://openrouter.ai/api/v1',
    },
    defaultModel: 'openai/gpt-4o-mini',
    maxTranscriptChars: 504000,
  },
  openRouterHeaders: (apiKey: string) => ({
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://magpie.app',
    'X-Title': 'Magpie',
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fetchModels, clearModelCache } from '../../src/services/modelService';

beforeEach(() => {
  mockFetch.mockReset();
  clearModelCache();
});

describe('fetchModels', () => {
  it('fetches model list from OpenRouter API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
        ],
      }),
    });

    const models = await fetchModels('sk-or-test-key');
    expect(models).toHaveLength(2);
    expect(models[0]?.id).toBeDefined();
    expect(models[0]?.name).toBeDefined();
  });

  it('returns cached list on subsequent calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }],
      }),
    });

    await fetchModels('sk-or-test-key');
    await fetchModels('sk-or-test-key');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(fetchModels('sk-or-test-key')).rejects.toThrow();
  });

  it('handles non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchModels('sk-or-test-key')).rejects.toThrow('Failed to fetch models: 500');
  });

  it('sends correct request URL and headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }],
      }),
    });

    await fetchModels('sk-or-my-key');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-or-my-key',
        }),
      }),
    );
  });

  it('refetches after clearModelCache is called', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }],
      }),
    });

    await fetchModels('sk-or-test-key');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    clearModelCache();
    await fetchModels('sk-or-test-key');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns models sorted alphabetically by name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'z-model', name: 'Zebra Model' },
          { id: 'a-model', name: 'Alpha Model' },
        ],
      }),
    });

    const models = await fetchModels('sk-or-test-key');
    expect(models[0]?.name).toBe('Alpha Model');
    expect(models[1]?.name).toBe('Zebra Model');
  });
});
