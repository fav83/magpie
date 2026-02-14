import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChat } from '../../src/services/streamingChat';
import type { StreamCallbacks } from '../../src/services/streamingChat';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function createSSEResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function makeSSEData(content: string, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    choices: [{ delta: { content }, finish_reason: finishReason }],
  })}\n`;
}

interface CallbackTracker extends StreamCallbacks {
  chunks: string[];
  completedWith: string | null;
  errorWith: { error: string; partial: string | null; details?: string } | null;
}

function createCallbacks(): CallbackTracker {
  const tracker: CallbackTracker = {
    chunks: [],
    completedWith: null,
    errorWith: null,
    onChunk: (content: string) => { tracker.chunks.push(content); },
    onComplete: (fullContent: string) => { tracker.completedWith = fullContent; },
    onError: (error: string, partial: string | null, details?: string) => {
      tracker.errorWith = { error, partial, details };
    },
  };
  return tracker;
}

const baseOptions = {
  history: [] as { role: 'user' | 'assistant'; content: string }[],
  userMessage: 'What is this video about?',
  summary: 'Test summary',
  transcript: 'Test transcript',
  apiKey: 'sk-test-key',
  model: 'openai/gpt-4o-mini',
};

describe('streamChat', () => {
  it('streams content chunks and completes', async () => {
    const sseData = makeSSEData('Hello') + makeSSEData(' World') + 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    expect(callbacks.chunks).toEqual(['Hello', ' World']);
    expect(callbacks.completedWith).toBe('Hello World');
    expect(callbacks.errorWith).toBeNull();
  });

  it('sends system message with summary and transcript', async () => {
    const sseData = makeSSEData('Response') + 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1].body as string) as {
      messages: { role: string; content: string }[];
    };

    expect(body.messages[0]?.role).toBe('system');
    expect(body.messages[0]?.content).toContain('Test summary');
    expect(body.messages[0]?.content).toContain('Test transcript');
  });

  it('includes chat history and user message', async () => {
    const sseData = makeSSEData('Response') + 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const history = [
      { role: 'user' as const, content: 'First question' },
      { role: 'assistant' as const, content: 'First answer' },
    ];

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, history, callbacks });

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1].body as string) as {
      messages: { role: string; content: string }[];
    };

    // system + 2 history + 1 user = 4 messages
    expect(body.messages).toHaveLength(4);
    expect(body.messages[1]?.role).toBe('user');
    expect(body.messages[1]?.content).toBe('First question');
    expect(body.messages[2]?.role).toBe('assistant');
    expect(body.messages[2]?.content).toBe('First answer');
    expect(body.messages[3]?.role).toBe('user');
    expect(body.messages[3]?.content).toBe('What is this video about?');
  });

  it('handles 401 as INVALID_API_KEY', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    expect(callbacks.errorWith?.error).toBe('INVALID_API_KEY');
    expect(callbacks.completedWith).toBeNull();
  });

  it('handles 429 as RATE_LIMITED', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    expect(callbacks.errorWith?.error).toBe('RATE_LIMITED');
  });

  it('handles non-OK status as API_ERROR with details', async () => {
    const errorBody = JSON.stringify({ error: { message: 'Bad request' } });
    mockFetch.mockResolvedValueOnce(new Response(errorBody, { status: 400 }));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    expect(callbacks.errorWith?.error).toBe('API_ERROR');
    expect(callbacks.errorWith?.details).toBe('Bad request');
  });

  it('handles mid-stream error chunk', async () => {
    const sseData =
      makeSSEData('Partial') +
      `data: ${JSON.stringify({ error: { code: 500, message: 'Server error' } })}\n`;
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    expect(callbacks.chunks).toEqual(['Partial']);
    expect(callbacks.errorWith?.error).toBe('API_ERROR');
    expect(callbacks.errorWith?.partial).toBe('Partial');
    expect(callbacks.errorWith?.details).toBe('Server error');
  });

  it('errors when no content received', async () => {
    const sseData = 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    expect(callbacks.errorWith?.error).toBe('API_ERROR');
    expect(callbacks.errorWith?.details).toBe('No content received from stream');
  });

  it('throws on abort without calling callbacks', async () => {
    const controller = new AbortController();
    controller.abort();

    const callbacks = createCallbacks();
    mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

    await expect(
      streamChat({ ...baseOptions, callbacks, signal: controller.signal })
    ).rejects.toThrow();

    expect(callbacks.completedWith).toBeNull();
    expect(callbacks.errorWith).toBeNull();
  });

  it('sends correct headers', async () => {
    const sseData = makeSSEData('Result') + 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sets stream: true in request body', async () => {
    const sseData = makeSSEData('Result') + 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1].body as string) as { stream: boolean };
    expect(body.stream).toBe(true);
  });

  it('includes the chat system prompt in system message', async () => {
    const sseData = makeSSEData('Result') + 'data: [DONE]\n';
    mockFetch.mockResolvedValueOnce(createSSEResponse([sseData]));

    const callbacks = createCallbacks();
    await streamChat({ ...baseOptions, callbacks });

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1].body as string) as {
      messages: { role: string; content: string }[];
    };

    expect(body.messages[0]?.content).toContain('helpful assistant');
    expect(body.messages[0]?.content).toContain('YouTube video content');
  });
});
