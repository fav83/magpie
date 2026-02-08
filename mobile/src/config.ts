export const config = {
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
  },
  defaultModel: 'openai/gpt-4o-mini',
  maxTranscriptChars: 504000, // ~128K tokens minus ~2K reserve, at ~4 chars/token
} as const;

export function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://magpie.app',
    'X-Title': 'Magpie',
  };
}
