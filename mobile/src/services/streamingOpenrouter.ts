import { config, openRouterHeaders } from '../config';
import { logError } from '../utils/logger';
import { parseSSEStream } from './sseParser';

export type SummaryError = 'INVALID_API_KEY' | 'RATE_LIMITED' | 'API_ERROR' | 'NETWORK_ERROR';

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: SummaryError, partialContent: string | null, errorDetails?: string) => void;
}

/**
 * Extract error message from OpenRouter error response.
 * OpenRouter errors can have nested structure with the actual error in metadata.raw
 */
function extractErrorDetails(errorBody: string): string | undefined {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: {
        message?: string;
        metadata?: {
          raw?: string;
        };
      }
    };

    // Try to extract the nested error message from metadata.raw first
    if (parsed.error?.metadata?.raw) {
      try {
        const rawParsed = JSON.parse(parsed.error.metadata.raw) as { message?: string };
        if (rawParsed.message) {
          return rawParsed.message;
        }
      } catch {
        // If raw is not valid JSON, use it directly if short enough
        if (parsed.error.metadata.raw.length < 200) {
          return parsed.error.metadata.raw;
        }
      }
    }

    // Fall back to the top-level error message
    return parsed.error?.message;
  } catch {
    // If not JSON, return the raw body if it's not too long
    if (errorBody && errorBody.length < 200) {
      return errorBody;
    }
    return undefined;
  }
}

/**
 * Stream a summary from OpenRouter using Server-Sent Events (SSE).
 * On abort: throws without calling callbacks (lets caller distinguish user-stop vs share-collision).
 */
export async function streamSummary(options: {
  transcript: string;
  apiKey: string;
  promptText: string;
  model: string;
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<void> {
  const { transcript, apiKey, promptText, model, callbacks, signal } = options;
  let accumulatedContent = '';

  const content = promptText.replace('{{transcript}}', transcript);

  const response = await fetch(`${config.openrouter.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...openRouterHeaders(apiKey),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      stream: true,
    }),
    signal: signal ?? null,
  });

  // Handle pre-stream errors (HTTP status codes)
  if (response.status === 401) {
    callbacks.onError('INVALID_API_KEY', null);
    return;
  }

  if (response.status === 429) {
    callbacks.onError('RATE_LIMITED', null);
    return;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    logError('streamSummary', `API error: ${String(response.status)} ${response.statusText}`);
    const errorDetails = extractErrorDetails(errorBody);
    callbacks.onError('API_ERROR', null, errorDetails);
    return;
  }

  // Process the SSE stream
  for await (const chunk of parseSSEStream(response, signal)) {
    // Check for mid-stream errors
    if (chunk.error) {
      logError('streamSummary', chunk.error);
      callbacks.onError('API_ERROR', accumulatedContent || null, chunk.error.message);
      return;
    }

    // Check for error finish reason
    if (chunk.finishReason === 'error') {
      logError('streamSummary', 'Stream finished with error');
      callbacks.onError('API_ERROR', accumulatedContent || null, 'Stream finished with error');
      return;
    }

    // Accumulate content and notify callback
    if (chunk.content) {
      accumulatedContent += chunk.content;
      callbacks.onChunk(chunk.content);
    }
  }

  // Stream completed successfully
  if (!accumulatedContent) {
    callbacks.onError('API_ERROR', null, 'No content received from stream');
    return;
  }

  callbacks.onComplete(accumulatedContent);
}
