import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchModels,
  getCachedModels,
  clearSessionCache,
  getModelContextLength,
  isValidModel,
} from '../../src/utils/modelsApi';
import type { OpenRouterModel } from '../../src/types/models';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};
const mockGet = vi.fn((keys: string[]) => {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in mockStorage) {
      result[key] = mockStorage[key];
    }
  }
  return Promise.resolve(result);
});
const mockSet = vi.fn((data: Record<string, unknown>) => {
  Object.assign(mockStorage, data);
  return Promise.resolve();
});

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
    },
  },
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const sampleModels: OpenRouterModel[] = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    context_length: 128000,
    pricing: { prompt: '0.00000015', completion: '0.0000006' },
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    context_length: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
  },
  {
    id: 'openai/dall-e-3',
    name: 'DALL-E 3',
    context_length: 4000,
    pricing: { prompt: '0.00004', completion: '0.00008' },
    architecture: { input_modalities: ['text'], output_modalities: ['image'] },
  },
  {
    id: 'openai/whisper',
    name: 'Whisper',
    context_length: 25000,
    pricing: { prompt: '0.00001', completion: '0' },
    architecture: { input_modalities: ['audio'], output_modalities: ['text'] },
  },
];

describe('modelsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    clearSessionCache();
  });

  afterEach(() => {
    clearSessionCache();
  });

  describe('fetchModels', () => {
    it('should fetch and filter text-only models', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: sampleModels }),
      });

      const result = await fetchModels('test-api-key');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        { headers: { Authorization: 'Bearer test-api-key' } }
      );

      // Should filter out DALL-E (image output) and Whisper (audio input)
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toContain('openai/gpt-4o-mini');
      expect(result.map((m) => m.id)).toContain('anthropic/claude-3.5-sonnet');
      expect(result.map((m) => m.id)).not.toContain('openai/dall-e-3');
      expect(result.map((m) => m.id)).not.toContain('openai/whisper');
    });

    it('should format pricing correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [sampleModels[0]] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.pricingDisplay).toBe('$0.15 / $0.60');
    });

    it('should sort models alphabetically by name', async () => {
      const unsortedModels: OpenRouterModel[] = [
        {
          id: 'z-model',
          name: 'Zeta Model',
          context_length: 1000,
          pricing: { prompt: '0.001', completion: '0.001' },
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        },
        {
          id: 'a-model',
          name: 'Alpha Model',
          context_length: 1000,
          pricing: { prompt: '0.001', completion: '0.001' },
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: unsortedModels }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.name).toBe('Alpha Model');
      expect(result[1]?.name).toBe('Zeta Model');
    });

    it('should use session cache on subsequent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [sampleModels[0]] }),
      });

      await fetchModels('test-api-key');
      await fetchModels('test-api-key');
      await fetchModels('test-api-key');

      // Should only fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should cache models to storage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [sampleModels[0]] }),
      });

      await fetchModels('test-api-key');

      expect(mockSet).toHaveBeenCalled();
      const cachedData = mockStorage.modelsCache as { models: unknown[]; timestamp: number };
      expect(cachedData.models).toHaveLength(1);
      expect(cachedData.timestamp).toBeGreaterThan(0);
    });

    it('should fall back to storage cache on API error', async () => {
      mockStorage.modelsCache = {
        models: [{ id: 'cached-model', name: 'Cached Model', contextLength: 1000, pricingDisplay: '$1.00 / $2.00' }],
        timestamp: Date.now(),
      };

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchModels('test-api-key');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('cached-model');
    });

    it('should throw error when API fails and no cache', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchModels('test-api-key')).rejects.toThrow('Network error');
    });

    it('should throw error on non-OK response when no cache', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(fetchModels('test-api-key')).rejects.toThrow('Failed to fetch models: 401');
    });

    it('should fall back to cache on non-OK response', async () => {
      mockStorage.modelsCache = {
        models: [{ id: 'cached-model', name: 'Cached Model', contextLength: 1000, pricingDisplay: '$1.00 / $2.00' }],
        timestamp: Date.now(),
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchModels('test-api-key');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('cached-model');
    });

    it('should include contextLength in model options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [sampleModels[1]] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.contextLength).toBe(200000);
    });
  });

  describe('getCachedModels', () => {
    it('should return null when no cache exists', async () => {
      const result = await getCachedModels();
      expect(result).toBeNull();
    });

    it('should return cached models when available', async () => {
      mockStorage.modelsCache = {
        models: [{ id: 'test-model', name: 'Test', contextLength: 1000, pricingDisplay: '$1/$2' }],
        timestamp: Date.now(),
      };

      const result = await getCachedModels();

      expect(result).toHaveLength(1);
      expect(result?.[0]?.id).toBe('test-model');
    });
  });

  describe('getModelContextLength', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: sampleModels }),
      });
    });

    it('should return context length for existing model', async () => {
      const contextLength = await getModelContextLength('anthropic/claude-3.5-sonnet', 'test-key');
      expect(contextLength).toBe(200000);
    });

    it('should return null for non-existent model', async () => {
      const contextLength = await getModelContextLength('non-existent-model', 'test-key');
      expect(contextLength).toBeNull();
    });
  });

  describe('isValidModel', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: sampleModels }),
      });
    });

    it('should return true for valid model', async () => {
      const isValid = await isValidModel('openai/gpt-4o-mini', 'test-key');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid model', async () => {
      const isValid = await isValidModel('invalid-model', 'test-key');
      expect(isValid).toBe(false);
    });

    it('should return false for filtered-out models', async () => {
      // DALL-E is filtered out because it has image output
      const isValid = await isValidModel('openai/dall-e-3', 'test-key');
      expect(isValid).toBe(false);
    });
  });

  describe('pricing formatting', () => {
    it('should format zero pricing correctly', async () => {
      const freeModel: OpenRouterModel = {
        id: 'free-model',
        name: 'Free Model',
        context_length: 1000,
        pricing: { prompt: '0', completion: '0' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [freeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.pricingDisplay).toBe('$0.00 / $0.00');
    });

    it('should format high pricing correctly', async () => {
      const expensiveModel: OpenRouterModel = {
        id: 'expensive-model',
        name: 'Expensive Model',
        context_length: 1000,
        pricing: { prompt: '0.00006', completion: '0.00024' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [expensiveModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.pricingDisplay).toBe('$60.00 / $240.00');
    });

    it('should handle invalid pricing values gracefully', async () => {
      const invalidPricingModel = {
        id: 'invalid-pricing',
        name: 'Invalid Pricing Model',
        context_length: 1000,
        pricing: { prompt: 'invalid', completion: '' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      } as unknown as OpenRouterModel;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [invalidPricingModel] }),
      });

      const result = await fetchModels('test-api-key');

      // Should not throw, and should default to $0.00
      expect(result[0]?.pricingDisplay).toBe('$0.00 / $0.00');
    });

    it('should handle missing pricing object gracefully', async () => {
      const missingPricingModel = {
        id: 'missing-pricing',
        name: 'Missing Pricing Model',
        context_length: 1000,
        pricing: undefined,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      } as unknown as OpenRouterModel;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [missingPricingModel] }),
      });

      const result = await fetchModels('test-api-key');

      // Should not throw, and should default to $0.00
      expect(result[0]?.pricingDisplay).toBe('$0.00 / $0.00');
    });
  });

  describe('isFree computation', () => {
    it('should set isFree to true when ID ends with :free AND prices are 0', async () => {
      const freeModel: OpenRouterModel = {
        id: 'mistralai/devstral:free',
        name: 'Devstral (Free)',
        context_length: 32000,
        pricing: { prompt: '0', completion: '0' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [freeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(true);
    });

    it('should set isFree to false when ID ends with :free but prices are not 0', async () => {
      const notReallyFreeModel: OpenRouterModel = {
        id: 'some/model:free',
        name: 'Model (Fake Free)',
        context_length: 32000,
        pricing: { prompt: '0.001', completion: '0' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [notReallyFreeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(false);
    });

    it('should set isFree to false when prices are 0 but ID does not end with :free', async () => {
      const zeroPriceNoSuffix: OpenRouterModel = {
        id: 'some/free-model',
        name: 'Free-ish Model',
        context_length: 32000,
        pricing: { prompt: '0', completion: '0' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [zeroPriceNoSuffix] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(false);
    });

    it('should set isFree to false for regular paid models', async () => {
      const paidModel: OpenRouterModel = {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        context_length: 128000,
        pricing: { prompt: '0.00000015', completion: '0.0000006' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [paidModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(false);
    });

    it('should set isFree to false when only prompt is 0 with :free suffix', async () => {
      const partialFreeModel: OpenRouterModel = {
        id: 'some/model:free',
        name: 'Partial Free',
        context_length: 32000,
        pricing: { prompt: '0', completion: '0.001' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [partialFreeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(false);
    });

    it('should set isFree to false when only completion is 0 with :free suffix', async () => {
      const partialFreeModel: OpenRouterModel = {
        id: 'some/model:free',
        name: 'Partial Free',
        context_length: 32000,
        pricing: { prompt: '0.001', completion: '0' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [partialFreeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(false);
    });

    it('should set isFree to true with "0.0" zero format', async () => {
      const freeModel: OpenRouterModel = {
        id: 'provider/model:free',
        name: 'Free Model',
        context_length: 32000,
        pricing: { prompt: '0.0', completion: '0.0' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [freeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(true);
    });

    it('should set isFree to true with "0.00" zero format', async () => {
      const freeModel: OpenRouterModel = {
        id: 'provider/model:free',
        name: 'Free Model',
        context_length: 32000,
        pricing: { prompt: '0.00', completion: '0.00' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [freeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(true);
    });

    it('should set isFree to true with mixed zero formats', async () => {
      const freeModel: OpenRouterModel = {
        id: 'provider/model:free',
        name: 'Free Model',
        context_length: 32000,
        pricing: { prompt: '0', completion: '0.00' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [freeModel] }),
      });

      const result = await fetchModels('test-api-key');

      expect(result[0]?.isFree).toBe(true);
    });
  });
});
