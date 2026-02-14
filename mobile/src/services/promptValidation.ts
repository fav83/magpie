import type { ValidationResult } from '../types/prompt';

export function validatePromptText(text: string): ValidationResult {
  if (!text.includes('{{transcript}}')) {
    return { valid: false, error: 'Prompt must include {{transcript}} placeholder.' };
  }
  return { valid: true };
}

export function validatePromptName(name: string): ValidationResult {
  if (!name.trim()) {
    return { valid: false, error: 'Prompt name cannot be empty.' };
  }
  return { valid: true };
}
