export interface Prompt {
  id: string;
  name: string;
  text: string;
  model: string;
  isDefault: boolean;
  /** System prompts cannot be deleted or have their name/text edited */
  isSystem: boolean;
  /** Built-in prompts ship with the extension and can be restored */
  isBuiltIn?: boolean;
}

export interface CachedSummary {
  summary: string;
  videoTitle: string;
  promptId: string;
  modelId: string;
  timestamp: number;
}

export interface PromptsStorage {
  prompts: Prompt[];
  defaultPromptId: string;
}

export interface SummaryCacheStorage {
  summaryCache: Record<string, CachedSummary>;
}

/** The system prompt ID (cannot be deleted) */
export const SYSTEM_PROMPT_ID = 'default-quick-summary';
