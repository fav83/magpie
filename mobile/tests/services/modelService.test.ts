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

import { fetchModels, clearModelCache, isFreeModel, formatPricingDisplay } from '../../src/services/modelService';
import type { ModelInfo } from '../../src/services/modelService';

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

  it('refetches when API key changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }],
      }),
    });

    await fetchModels('sk-or-key-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await fetchModels('sk-or-key-2');
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

  it('parses pricing from API response strings', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'test/model',
            name: 'Test Model',
            pricing: { prompt: '0.0000025', completion: '0.00001' },
          },
        ],
      }),
    });

    const models = await fetchModels('sk-or-test-key');
    // API returns per-token, we multiply by 1M
    expect(models[0]?.pricing.prompt).toBeCloseTo(2.5);
    expect(models[0]?.pricing.completion).toBeCloseTo(10);
  });

  it('defaults pricing to 0 when missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'free/model', name: 'Free Model' }],
      }),
    });

    const models = await fetchModels('sk-or-test-key');
    expect(models[0]?.pricing.prompt).toBe(0);
    expect(models[0]?.pricing.completion).toBe(0);
  });

  it('refetches after cache TTL expires', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'test/model', name: 'Test' }],
      }),
    });

    await fetchModels('sk-or-test-key');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time past the 1-hour TTL
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 60 * 1000);

    await fetchModels('sk-or-test-key');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });
});

describe('isFreeModel', () => {
  it('returns true when both prompt and completion pricing are 0', () => {
    const model: ModelInfo = { id: 'free/model', name: 'Free', pricing: { prompt: 0, completion: 0 } };
    expect(isFreeModel(model)).toBe(true);
  });

  it('returns false when prompt pricing is non-zero', () => {
    const model: ModelInfo = { id: 'paid/model', name: 'Paid', pricing: { prompt: 2.5, completion: 0 } };
    expect(isFreeModel(model)).toBe(false);
  });

  it('returns false when completion pricing is non-zero', () => {
    const model: ModelInfo = { id: 'paid/model', name: 'Paid', pricing: { prompt: 0, completion: 10 } };
    expect(isFreeModel(model)).toBe(false);
  });
});

describe('formatPricingDisplay', () => {
  it('returns "Free" for zero pricing', () => {
    expect(formatPricingDisplay({ prompt: 0, completion: 0 })).toBe('Free');
  });

  it('formats non-zero pricing as dollar amounts per 1M tokens', () => {
    expect(formatPricingDisplay({ prompt: 2.5, completion: 10 })).toBe('$2.50 / $10.00');
  });

  it('formats small pricing values', () => {
    expect(formatPricingDisplay({ prompt: 0.15, completion: 0.6 })).toBe('$0.15 / $0.60');
  });
});
