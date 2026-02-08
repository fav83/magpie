export const config = {
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
    apiKey: import.meta.env.VITE_OPENROUTER_API_KEY as string || '',
    model: 'openai/gpt-4o-mini',
  },
  prompt: `Summarize in 3-5 short bullet points:
• What's the main topic?
• What are the key points?
• What's the takeaway?

One sentence per bullet. No preamble or introduction - start directly with the bullets.

{{transcript}}`,
  maxTranscriptChars: 504000, // ~128K tokens minus ~2K reserve, at ~4 chars/token
} as const;
