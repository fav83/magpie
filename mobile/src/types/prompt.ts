export interface Prompt {
  id: string;
  name: string;
  text: string;
  model: string;
  isDefault: boolean;
  /** System prompts cannot be deleted or have their name/text edited */
  isSystem: boolean;
  /** Built-in prompts ship with the app and can be restored */
  isBuiltIn?: boolean;
  /** True if user has edited a built-in prompt's text or name */
  isModified?: boolean;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** The system prompt ID (cannot be deleted) */
export const SYSTEM_PROMPT_ID = 'default-quick-summary';
