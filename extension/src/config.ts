import type { SummaryError } from './types/messages';
import defaultPromptsData from './data/defaultPrompts.json';

/**
 * Storage keys organized by category.
 * All keys use flat structure for Chrome storage compatibility,
 * but are organized here for better discoverability.
 */
export const STORAGE_KEYS = {
  // User settings
  API_KEY: 'openrouterApiKey',
  FONT_SIZE: 'summaryFontSize',

  // Prompts
  PROMPTS: 'prompts',
  DEFAULT_PROMPT_ID: 'defaultPromptId',

  // Summaries and cache
  ACCORDION_ITEMS: 'accordionItems',
  MODELS_CACHE: 'modelsCache',
  OLD_CACHE: 'summaryCache',

  // Migration flags
  MIGRATION_COMPLETE: 'accordionMigrationComplete',
  DEFAULT_PROMPTS_VERSION: 'defaultPromptsVersion',

  // Model preferences
  PREFERRED_MODELS: 'preferredModels',
  SHOW_FREE_ONLY_OPTIONS: 'showFreeOnlyOptions',
  SHOW_FREE_ONLY_SIDEBAR: 'showFreeOnlySidebar',

  // Chat
  VIDEO_CHATS: 'videoChats',
  CHAT_SYSTEM_PROMPT: 'chatSystemPrompt',
} as const;

/** Type-safe access to storage key values */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export const config = {
  openrouter: {
    apiUrl: (import.meta.env.VITE_OPENROUTER_API_URL as string | undefined) ?? 'https://openrouter.ai/api/v1',
  },
} as const;

export const DEFAULT_PROMPT = `Summarize in 3-5 short bullet points:
• What's the main topic?
• What are the key points?
• What's the takeaway?

One sentence per bullet. No preamble or introduction - start directly with the bullets.

{{transcript}}`;

/**
 * Default prompts that ship with the extension.
 * Version is used to track updates and add new prompts to existing users.
 * Prompts are defined in src/data/defaultPrompts.json for easy editing.
 */
export const DEFAULT_PROMPTS_VERSION = 4;

export interface DefaultPromptDefinition {
  id: string;
  name: string;
  text: string;
  model: string;
  isSystem: boolean;
}

export const DEFAULT_PROMPTS: DefaultPromptDefinition[] = defaultPromptsData;

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions about YouTube video content. You have access to the video's transcript and summary.

Use the transcript as your primary source of truth. Reference specific parts of the video when relevant. If something isn't covered in the transcript, say so.

Keep responses concise but informative.`;

export const FONT_SIZE = {
  MIN: 6,
  MAX: 24,
  DEFAULT: 12,
} as const;

export const ERROR_MESSAGES: Record<SummaryError, string> = {
  NO_API_KEY: 'Please add your API key in settings.',
  INVALID_API_KEY: 'Invalid API key. Please check your settings.',
  RATE_LIMITED: 'Rate limited. Please try again later.',
  API_ERROR: 'Failed to generate summary. Please try again.',
  NOT_YOUTUBE_VIDEO: 'Navigate to a YouTube video to get a summary.',
  NO_CAPTIONS: 'No captions available for this video.',
  VIDEO_NOT_FOUND: 'Could not find video information.',
  EXTRACTION_FAILED: 'Failed to extract transcript.',
  CONTEXT_TOO_LONG: 'Transcript too long for this model. Try a model with larger context.',
  AD_PLAYING: 'Ad is playing. Will retry automatically when ad finishes.',
  Cancelled: 'Generation cancelled.',
  Stopped: 'Stopped - switched to another video.',
  'Connection lost': 'Connection lost. Please try again.',
};

// UI-specific messages (not tied to SummaryError type)
export const UI_MESSAGES = {
  PROMPT_NOT_FOUND: 'Prompt not found',
  FALLBACK_ERROR: 'Failed to generate summary',
  LOADING_TITLE: 'Loading...',
} as const;

// Invalid video titles that should be replaced
export const INVALID_TITLES = ['Unknown', 'YouTube'] as const;

// Chrome runtime port names
export const PORT_NAMES = {
  SUMMARY_STREAM: 'summary-stream',
  CHAT_STREAM: 'chat-stream',
} as const;

/**
 * Get a user-friendly error message for a SummaryError
 */
export function getErrorMessage(error: SummaryError, errorDetails?: string): string {
  const baseMessage = ERROR_MESSAGES[error];

  // For API errors, include the details from OpenRouter if available
  if (error === 'API_ERROR' && errorDetails) {
    return `OpenRouter error: ${errorDetails}`;
  }

  return baseMessage;
}
