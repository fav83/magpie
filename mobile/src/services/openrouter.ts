import type { Result } from '../types/result';
import { config, openRouterHeaders } from '../config';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export type SummaryError = 'INVALID_API_KEY' | 'RATE_LIMITED' | 'API_ERROR' | 'NETWORK_ERROR';

export async function generateSummary(
  transcript: string,
  apiKey: string,
  promptText: string,
  model: string,
  signal?: AbortSignal
): Promise<Result<string, SummaryError>> {
  try {
    const content = promptText.replace('{{transcript}}', transcript);

    const response = await fetch(`${config.openrouter.apiUrl}/chat/completions`, {
      method: 'POST',
      signal: signal ?? null,
      headers: {
        'Content-Type': 'application/json',
        ...openRouterHeaders(apiKey),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
      }),
    });

    if (response.status === 401) {
      return { success: false, error: 'INVALID_API_KEY' };
    }

    if (response.status === 429) {
      return { success: false, error: 'RATE_LIMITED' };
    }

    if (!response.ok) {
      return { success: false, error: 'API_ERROR' };
    }

    const data = (await response.json()) as OpenRouterResponse;
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      return { success: false, error: 'API_ERROR' };
    }

    return { success: true, data: summary };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, error: 'NETWORK_ERROR' };
    }
    return { success: false, error: 'API_ERROR' };
  }
}
