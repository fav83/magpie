import { config, openRouterHeaders, DEFAULT_CHAT_SYSTEM_PROMPT } from '../config';
import { logError } from '../utils/logger';
import { parseSSEStream } from './sseParser';
import { extractErrorDetails } from './apiErrorUtils';
import type { StreamCallbacks, SummaryError } from './streamingOpenrouter';

export type { StreamCallbacks, SummaryError };

interface ChatApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function buildSystemMessage(summary: string, transcript: string): string {
  return `${DEFAULT_CHAT_SYSTEM_PROMPT}\n\n## Video Summary\n${summary}\n\n## Full Transcript\n${transcript}`;
}

/**
 * Stream a chat response from OpenRouter using SSE.
 * On abort: throws without calling callbacks (lets caller distinguish user-stop vs collision).
 */
export async function streamChat(options: {
  history: ChatApiMessage[];
  userMessage: string;
  summary: string;
  transcript: string;
  apiKey: string;
  model: string;
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<void> {
  const { history, userMessage, summary, transcript, apiKey, model, callbacks, signal } = options;
  let accumulatedContent = '';

  const messages: ChatApiMessage[] = [
    { role: 'system', content: buildSystemMessage(summary, transcript) },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${config.openrouter.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...openRouterHeaders(apiKey),
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: signal ?? null,
  });

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
    logError('streamChat', `API error: ${String(response.status)} ${response.statusText}`);
    const errorDetails = extractErrorDetails(errorBody);
    callbacks.onError('API_ERROR', null, errorDetails);
    return;
  }

  for await (const chunk of parseSSEStream(response, signal)) {
    if (chunk.error) {
      logError('streamChat', chunk.error);
      callbacks.onError('API_ERROR', accumulatedContent || null, chunk.error.message);
      return;
    }

    if (chunk.finishReason === 'error') {
      logError('streamChat', 'Stream finished with error');
      callbacks.onError('API_ERROR', accumulatedContent || null, 'Stream finished with error');
      return;
    }

    if (chunk.content) {
      accumulatedContent += chunk.content;
      callbacks.onChunk(chunk.content);
    }
  }

  if (!accumulatedContent) {
    callbacks.onError('API_ERROR', null, 'No content received from stream');
    return;
  }

  callbacks.onComplete(accumulatedContent);
}
