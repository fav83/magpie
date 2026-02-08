import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSummary } from '../../src/services/openrouter';

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

beforeEach(() => {
  mockFetch.mockReset();
});

describe('generateSummary', () => {
  const promptText = 'Summarize: {{transcript}}';
  const model = 'openai/gpt-4o-mini';

  it('returns summary on successful response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'This is a summary' } }],
      }),
    });

    const result = await generateSummary('transcript text', 'sk-or-test-key', promptText, model);
    expect(result).toEqual({ success: true, data: 'This is a summary' });
  });

  it('sends correct request body with prompt text and model', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'summary' } }],
      }),
    });

    await generateSummary('my transcript', 'sk-or-my-key', promptText, 'anthropic/claude-3.5-haiku');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-or-my-key',
        }),
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-haiku',
          messages: [{ role: 'user', content: 'Summarize: my transcript' }],
        }),
      }),
    );
  });

  it('replaces {{transcript}} in the passed prompt text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'summary' } }],
      }),
    });

    await generateSummary('hello world', 'sk-or-key', 'Custom prompt: {{transcript}}', model);

    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0]?.content).toBe('Custom prompt: hello world');
  });

  it('returns INVALID_API_KEY on 401', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await generateSummary('transcript', 'sk-or-bad', promptText, model);
    expect(result).toEqual({ success: false, error: 'INVALID_API_KEY' });
  });

  it('returns RATE_LIMITED on 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    const result = await generateSummary('transcript', 'sk-or-key', promptText, model);
    expect(result).toEqual({ success: false, error: 'RATE_LIMITED' });
  });

  it('returns API_ERROR on other HTTP errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await generateSummary('transcript', 'sk-or-key', promptText, model);
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('returns API_ERROR when response has no choices', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });

    const result = await generateSummary('transcript', 'sk-or-key', promptText, model);
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('returns API_ERROR when choices is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await generateSummary('transcript', 'sk-or-key', promptText, model);
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('returns NETWORK_ERROR on fetch TypeError', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const result = await generateSummary('transcript', 'sk-or-key', promptText, model);
    expect(result).toEqual({ success: false, error: 'NETWORK_ERROR' });
  });

  it('returns API_ERROR on non-fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('something else'));

    const result = await generateSummary('transcript', 'sk-or-key', promptText, model);
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('passes AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'summary' } }],
      }),
    });

    const controller = new AbortController();
    await generateSummary('transcript', 'sk-or-key', promptText, model, controller.signal);

    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(call[1].signal).toBe(controller.signal);
  });

  it('passes null signal when no AbortSignal provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'summary' } }],
      }),
    });

    await generateSummary('transcript', 'sk-or-key', promptText, model);

    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(call[1].signal).toBeNull();
  });
});
