export const config = {
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
  },
  defaultModel: 'openai/gpt-4o-mini',
  maxTranscriptChars: 504000, // ~128K tokens minus ~2K reserve, at ~4 chars/token
} as const;

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions about YouTube video content. You have access to the video's transcript and summary.

Use the transcript as your primary source of truth. Reference specific parts of the video when relevant. If something isn't covered in the transcript, say so.

Keep responses concise but informative.`;

export function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://magpie.app',
    'X-Title': 'Magpie',
  };
}
