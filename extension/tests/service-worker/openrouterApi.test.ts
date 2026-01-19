import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { summarizeTranscript } from '../../src/service-worker/openrouterApi';

// Mock config
vi.mock('../../src/config', () => ({
  config: {
    openrouter: {
      apiUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
    },
  },
}));

const DEFAULT_PROMPT = 'Summarize: {{transcript}}';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

describe('summarizeTranscript', () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  it('should return summary on successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Test summary' } }],
        }),
    });

    const result = await summarizeTranscript({
      transcript: 'transcript',
      apiKey: 'sk-or-test',
      prompt: DEFAULT_PROMPT,
      model: DEFAULT_MODEL,
    });
    expect(result).toEqual({ success: true, data: 'Test summary' });
  });

  it('should return INVALID_API_KEY on 401', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await summarizeTranscript({
      transcript: 'transcript',
      apiKey: 'bad-key',
      prompt: DEFAULT_PROMPT,
      model: DEFAULT_MODEL,
    });
    expect(result).toEqual({ success: false, error: 'INVALID_API_KEY' });
  });

  it('should return RATE_LIMITED on 429', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await summarizeTranscript({
      transcript: 'transcript',
      apiKey: 'sk-or-test',
      prompt: DEFAULT_PROMPT,
      model: DEFAULT_MODEL,
    });
    expect(result).toEqual({ success: false, error: 'RATE_LIMITED' });
  });

  it('should return API_ERROR on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await summarizeTranscript({
      transcript: 'transcript',
      apiKey: 'sk-or-test',
      prompt: DEFAULT_PROMPT,
      model: DEFAULT_MODEL,
    });
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('should return API_ERROR when response has no choices', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [] }),
    });

    const result = await summarizeTranscript({
      transcript: 'transcript',
      apiKey: 'sk-or-test',
      prompt: DEFAULT_PROMPT,
      model: DEFAULT_MODEL,
    });
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('should return API_ERROR on 500 status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await summarizeTranscript({
      transcript: 'transcript',
      apiKey: 'sk-or-test',
      prompt: DEFAULT_PROMPT,
      model: DEFAULT_MODEL,
    });
    expect(result).toEqual({ success: false, error: 'API_ERROR' });
  });

  it('should replace {{transcript}} placeholder in custom prompt', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Custom summary' } }],
        }),
    });

    const customPrompt = 'Please analyze this: {{transcript}}\n\nBe concise.';
    await summarizeTranscript({
      transcript: 'my transcript text',
      apiKey: 'sk-or-test',
      prompt: customPrompt,
      model: DEFAULT_MODEL,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('Please analyze this: my transcript text'),
      })
    );
  });
});
