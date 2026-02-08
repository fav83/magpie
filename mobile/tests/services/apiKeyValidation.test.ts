import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApiKeyFormat, validateApiKeyServer } from '../../src/services/apiKeyValidation';

vi.mock('../../src/config', () => ({
  config: {
    openrouter: {
      apiUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
    },
    prompt: 'Summarize: {{transcript}}',
    maxTranscriptChars: 504000,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('validateApiKeyFormat', () => {
  it('returns null for valid key starting with sk-or-', () => {
    expect(validateApiKeyFormat('sk-or-v1-abc123')).toBeNull();
  });

  it('returns error for key not starting with sk-or-', () => {
    expect(validateApiKeyFormat('sk-abc123')).toBe(
      'Invalid key format. Should start with sk-or-',
    );
  });

  it('returns error for empty string', () => {
    expect(validateApiKeyFormat('')).toBe(
      'Invalid key format. Should start with sk-or-',
    );
  });

  it('returns null for minimal valid key', () => {
    expect(validateApiKeyFormat('sk-or-x')).toBeNull();
  });
});

describe('validateApiKeyServer', () => {
  it('returns valid on 2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await validateApiKeyServer('sk-or-valid-key');

    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/auth/key',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-or-valid-key',
        }),
      }),
    );
  });

  it('returns error on 401', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await validateApiKeyServer('sk-or-bad-key');

    expect(result).toEqual({ valid: false, error: 'Invalid API key' });
  });

  it('returns error on 403', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    const result = await validateApiKeyServer('sk-or-bad-key');

    expect(result).toEqual({ valid: false, error: 'Invalid API key' });
  });

  it('returns API error on other HTTP errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await validateApiKeyServer('sk-or-key');

    expect(result).toEqual({ valid: false, error: 'API error: 500' });
  });

  it('returns network error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const result = await validateApiKeyServer('sk-or-key');

    expect(result).toEqual({
      valid: false,
      error: 'Network error. Check your connection.',
    });
  });

  it('returns network error on other exceptions', async () => {
    mockFetch.mockRejectedValue(new Error('something else'));

    const result = await validateApiKeyServer('sk-or-key');

    expect(result).toEqual({
      valid: false,
      error: 'Network error. Check your connection.',
    });
  });
});
