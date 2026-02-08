import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSummary } from '../../src/services/openrouter';

// Mock config to avoid import.meta.env issues in tests
vi.mock('../../src/config', () => ({
  config: {
    openrouter: {
      apiUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
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

describe('generateSummary', () => {
  it('returns summary on successful response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'This is a summary' } }],
      }),
    });

    const result = await generateSummary('transcript text');
    expect(result).toEqual({ success: true, data: 'This is a summary' });
  });

  it('sends correct request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'summary' } }],
      }),
    });

    await generateSummary('my transcript');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: 'Summarize: my transcript' }],
        }),
      }),
    );
  });

  it('returns INVALID_API_KEY on 401', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'INVALID_API_KEY' });
  });

  it('returns RATE_LIMITED on 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'RATE_LIMITED' });
  });

  it('returns API_ERROR on other HTTP errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('returns API_ERROR when response has no choices', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('returns API_ERROR when choices is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('returns NETWORK_ERROR on fetch TypeError', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'NETWORK_ERROR' });
  });

  it('returns API_ERROR on non-fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('something else'));

    const result = await generateSummary('transcript');
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });
});
