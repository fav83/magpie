import { describe, it, expect } from 'vitest';
import { validatePromptName, validatePromptText } from '../../src/services/promptValidation';

describe('validatePromptName', () => {
  it('fails for empty string', () => {
    const result = validatePromptName('');
    expect(result).toEqual({ valid: false, error: 'Prompt name cannot be empty.' });
  });

  it('fails for whitespace-only string', () => {
    const result = validatePromptName('   ');
    expect(result).toEqual({ valid: false, error: 'Prompt name cannot be empty.' });
  });

  it('passes for non-empty string', () => {
    const result = validatePromptName('My Prompt');
    expect(result).toEqual({ valid: true });
  });
});

describe('validatePromptText', () => {
  it('fails when missing {{transcript}}', () => {
    const result = validatePromptText('Summarize this video');
    expect(result).toEqual({ valid: false, error: 'Prompt must include {{transcript}} placeholder.' });
  });

  it('passes when {{transcript}} is present', () => {
    const result = validatePromptText('Summarize: {{transcript}}');
    expect(result).toEqual({ valid: true });
  });
});
