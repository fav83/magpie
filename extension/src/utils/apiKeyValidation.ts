import { config } from '../config';

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates the format of an OpenRouter API key.
 */
export function validateApiKeyFormat(apiKey: string): ApiKeyValidationResult {
  if (!apiKey.startsWith('sk-or-')) {
    return { valid: false, error: 'Invalid key format. Should start with sk-or-' };
  }
  return { valid: true };
}

/**
 * Tests an API key against the OpenRouter API.
 * Returns validation result with error message if invalid.
 */
export async function testApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  const formatResult = validateApiKeyFormat(apiKey);
  if (!formatResult.valid) {
    return formatResult;
  }

  try {
    const response = await fetch(`${config.openrouter.apiUrl}/auth/key`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'Magpie',
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    } else {
      return { valid: false, error: `API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Network error. Check your connection.' };
  }
}
