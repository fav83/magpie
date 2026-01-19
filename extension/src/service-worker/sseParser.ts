/**
 * SSE Parser for OpenRouter streaming responses
 */

export class StreamAbortedError extends Error {
  constructor() {
    super('Stream aborted');
    this.name = 'StreamAbortedError';
  }
}

export interface SSEChunk {
  content: string;
  finishReason: string | null;
  error?: { code: number | string; message: string };
}

export interface SSEParseResult {
  chunk: SSEChunk | null;
  done: boolean;
}

/**
 * Parse a single SSE line into a chunk
 */
export function parseSSELine(line: string): SSEParseResult {
  // Strip carriage return in case of CRLF line endings
  const trimmedLine = line.replace(/\r$/, '');

  // Skip empty lines and keep-alive comments (: OPENROUTER PROCESSING)
  if (!trimmedLine || trimmedLine.startsWith(':')) {
    return { chunk: null, done: false };
  }

  if (!trimmedLine.startsWith('data: ')) {
    return { chunk: null, done: false };
  }

  const data = trimmedLine.slice(6); // Remove 'data: ' prefix

  // Check for stream termination
  if (data === '[DONE]') {
    return { chunk: null, done: true };
  }

  try {
    const parsed = JSON.parse(data) as {
      choices?: {
        delta?: { content?: string };
        finish_reason?: string | null;
      }[];
      error?: { code: number | string; message: string };
    };

    const choice = parsed.choices?.[0];
    const content = choice?.delta?.content ?? '';
    const finishReason = choice?.finish_reason ?? null;
    const error = parsed.error;

    const chunk: SSEChunk = { content, finishReason };
    if (error) {
      chunk.error = error;
    }

    return {
      chunk,
      done: finishReason === 'error' || Boolean(error),
    };
  } catch {
    // Skip malformed JSON
    return { chunk: null, done: false };
  }
}

/**
 * Async generator that yields SSE chunks from a ReadableStream
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<SSEChunk, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional infinite loop
    while (true) {
      // Check for abort signal - throw to ensure proper cancellation handling
      if (signal?.aborted) {
        throw new StreamAbortedError();
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const result = parseSSELine(line);

        if (result.done) {
          // Yield the final chunk if it has content or error
          if (result.chunk) {
            yield result.chunk;
          }
          return;
        }

        if (result.chunk && (result.chunk.content || result.chunk.error)) {
          yield result.chunk;
        }
      }
    }

    // Process any remaining buffer
    if (buffer) {
      const result = parseSSELine(buffer);
      if (result.chunk && (result.chunk.content || result.chunk.error)) {
        yield result.chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
