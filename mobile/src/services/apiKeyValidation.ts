import { config } from '../config';

export function validateApiKeyFormat(key: string): string | null {
  if (!key.startsWith('sk-or-')) {
    return 'Invalid key format. Should start with sk-or-';
  }
  return null;
}

export async function validateApiKeyServer(
  apiKey: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const response = await fetch(`${config.openrouter.apiUrl}/auth/key`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://magpie.app',
        'X-Title': 'Magpie',
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch {
    return { valid: false, error: 'Network error. Check your connection.' };
  }
}
