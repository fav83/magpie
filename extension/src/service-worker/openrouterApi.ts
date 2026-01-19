import { config } from '../config';
import type { ApiResult, OpenRouterResponse } from '../types/summary';
import type { SummaryError } from '../types/messages';
import { log, logError } from '../utils/logger';
import { parseSSEStream, StreamAbortedError } from './sseParser';

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: SummaryError, partialContent: string | null, errorDetails?: string) => void;
}

export interface StreamResult {
  success: boolean;
  error?: string;
}

export interface SummarizeOptions {
  transcript: string;
  apiKey: string;
  prompt: string;
  model: string;
}

export interface StreamOptions extends SummarizeOptions {
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}

export interface ChatStreamOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  apiKey: string;
  model: string;
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}

/**
 * Extract error message from OpenRouter error response
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

export async function summarizeTranscript({
  transcript,
  apiKey,
  prompt,
  model,
}: SummarizeOptions): Promise<ApiResult<string>> {
  try {
    log('Sending request to OpenRouter');
    log('Using model:', model);

    log('Transcript length:', transcript.length);
    log('Transcript preview:', transcript.substring(0, 200) + '...');

    // Support both {{transcript}} (new) and {transcript} (legacy) placeholders
    const content = prompt
      .replace('{{transcript}}', transcript)
      .replace('{transcript}', transcript);

    const requestBody = {
      model,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    };

    log('Request body:', JSON.stringify(requestBody).substring(0, 500));

    const response = await fetch(
      `${config.openrouter.apiUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Magpie',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (response.status === 401) {
      logError('Invalid API key');
      return { success: false, error: 'INVALID_API_KEY' };
    }

    if (response.status === 429) {
      logError('Rate limited');
      return { success: false, error: 'RATE_LIMITED' };
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logError('API error:', response.status, response.statusText, errorBody);
      return { success: false, error: 'API_ERROR' };
    }

    const data = (await response.json()) as OpenRouterResponse;
    const summary = data.choices[0]?.message.content;

    if (!summary) {
      logError('No summary in response');
      return { success: false, error: 'API_ERROR' };
    }

    log('Summary received:', summary.substring(0, 100) + '...');
    return { success: true, data: summary };
  } catch (error) {
    logError('Network error:', error);
    return { success: false, error: 'API_ERROR' };
  }
}

/**
 * Stream a summary using Server-Sent Events (SSE)
 */
export async function streamSummary({
  transcript,
  apiKey,
  prompt,
  model,
  callbacks,
  signal,
}: StreamOptions): Promise<StreamResult> {
  let accumulatedContent = '';

  try {
    log('Starting streaming request to OpenRouter');
    log('Using model:', model);

    // Support both {{transcript}} (new) and {transcript} (legacy) placeholders
    const content = prompt
      .replace('{{transcript}}', transcript)
      .replace('{transcript}', transcript);

    const requestBody = {
      model,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      stream: true,
    };

    const response = await fetch(
      `${config.openrouter.apiUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Magpie',
        },
        body: JSON.stringify(requestBody),
        signal: signal ?? null,
      }
    );

    // Handle pre-stream errors (HTTP status codes)
    if (response.status === 401) {
      logError('Invalid API key');
      callbacks.onError('INVALID_API_KEY', null);
      return { success: false, error: 'INVALID_API_KEY' };
    }

    if (response.status === 429) {
      logError('Rate limited');
      callbacks.onError('RATE_LIMITED', null);
      return { success: false, error: 'RATE_LIMITED' };
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logError('API error:', response.status, response.statusText, errorBody);
      const errorDetails = extractErrorDetails(errorBody);
      callbacks.onError('API_ERROR', null, errorDetails);
      return { success: false, error: 'API_ERROR' };
    }

    // Process the SSE stream
    for await (const chunk of parseSSEStream(response, signal)) {
      // Check for mid-stream errors
      if (chunk.error) {
        logError('Mid-stream error:', chunk.error);
        callbacks.onError('API_ERROR', accumulatedContent || null, chunk.error.message);
        return { success: false, error: 'API_ERROR' };
      }

      // Check for error finish reason
      if (chunk.finishReason === 'error') {
        logError('Stream finished with error');
        callbacks.onError('API_ERROR', accumulatedContent || null, 'Stream finished with error');
        return { success: false, error: 'API_ERROR' };
      }

      // Accumulate content and notify callback
      if (chunk.content) {
        accumulatedContent += chunk.content;
        callbacks.onChunk(chunk.content);
      }
    }

    // Stream completed successfully
    if (!accumulatedContent) {
      logError('No content received from stream');
      callbacks.onError('API_ERROR', null, 'No content received from stream');
      return { success: false, error: 'API_ERROR' };
    }

    log('Stream completed, total length:', accumulatedContent.length);
    callbacks.onComplete(accumulatedContent);
    return { success: true };
  } catch (error) {
    // Handle abort from fetch or SSE parser
    if (
      error instanceof StreamAbortedError ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      log('Stream aborted by user');
      callbacks.onError('Cancelled', accumulatedContent || null);
      return { success: false, error: 'Cancelled' };
    }

    logError('Network error during streaming:', error);
    const networkErrorMessage = error instanceof Error ? error.message : 'Network error';
    callbacks.onError('API_ERROR', accumulatedContent || null, networkErrorMessage);
    return { success: false, error: 'API_ERROR' };
  }
}

/**
 * Stream a chat response using Server-Sent Events (SSE)
 */
export async function streamChat({
  messages,
  apiKey,
  model,
  callbacks,
  signal,
}: ChatStreamOptions): Promise<StreamResult> {
  let accumulatedContent = '';

  try {
    log('Starting chat streaming request to OpenRouter');
    log('Using model:', model);

    const requestBody = {
      model,
      messages,
      stream: true,
    };

    const response = await fetch(
      `${config.openrouter.apiUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Magpie',
        },
        body: JSON.stringify(requestBody),
        signal: signal ?? null,
      }
    );

    // Handle pre-stream errors (HTTP status codes)
    if (response.status === 401) {
      logError('Invalid API key');
      callbacks.onError('INVALID_API_KEY', null);
      return { success: false, error: 'INVALID_API_KEY' };
    }

    if (response.status === 429) {
      logError('Rate limited');
      callbacks.onError('RATE_LIMITED', null);
      return { success: false, error: 'RATE_LIMITED' };
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logError('API error:', response.status, response.statusText, errorBody);
      const errorDetails = extractErrorDetails(errorBody);
      callbacks.onError('API_ERROR', null, errorDetails);
      return { success: false, error: 'API_ERROR' };
    }

    // Process the SSE stream
    for await (const chunk of parseSSEStream(response, signal)) {
      // Check for mid-stream errors
      if (chunk.error) {
        logError('Mid-stream error:', chunk.error);
        callbacks.onError('API_ERROR', accumulatedContent || null, chunk.error.message);
        return { success: false, error: 'API_ERROR' };
      }

      // Check for error finish reason
      if (chunk.finishReason === 'error') {
        logError('Chat stream finished with error');
        callbacks.onError('API_ERROR', accumulatedContent || null, 'Chat stream finished with error');
        return { success: false, error: 'API_ERROR' };
      }

      // Accumulate content and notify callback
      if (chunk.content) {
        accumulatedContent += chunk.content;
        callbacks.onChunk(chunk.content);
      }
    }

    // Stream completed successfully
    if (!accumulatedContent) {
      logError('No content received from chat stream');
      callbacks.onError('API_ERROR', null, 'No content received from chat stream');
      return { success: false, error: 'API_ERROR' };
    }

    log('Chat stream completed, total length:', accumulatedContent.length);
    callbacks.onComplete(accumulatedContent);
    return { success: true };
  } catch (error) {
    // Handle abort from fetch or SSE parser
    if (
      error instanceof StreamAbortedError ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      log('Chat stream aborted by user');
      callbacks.onError('Cancelled', accumulatedContent || null);
      return { success: false, error: 'Cancelled' };
    }

    logError('Network error during chat streaming:', error);
    const networkErrorMessage = error instanceof Error ? error.message : 'Network error';
    callbacks.onError('API_ERROR', accumulatedContent || null, networkErrorMessage);
    return { success: false, error: 'API_ERROR' };
  }
}
