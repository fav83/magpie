import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Capacitor Preferences
const mockStorage: Record<string, string> = {};
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: mockStorage[key] ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      mockStorage[key] = value;
    }),
  },
}));

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

import {
  getPrompts,
  savePrompts,
  getDefaultPromptId,
  setDefaultPromptId,
  getDefaultPrompt,
  getPromptById,
  addPrompt,
  updatePrompt,
  deletePrompt,
  duplicatePrompt,
  resetBuiltInPrompt,
  validatePromptName,
  validatePromptText,
  generatePromptId,
} from '../../src/services/promptStorage';
import { SYSTEM_PROMPT_ID } from '../../src/types/prompt';

beforeEach(() => {
  // Clear storage
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  uuidCounter = 0;
});

describe('getPrompts', () => {
  it('seeds all 14 built-in prompts on first call (fresh install)', async () => {
    const prompts = await getPrompts();
    expect(prompts.length).toBe(14);
    expect(prompts.every((p) => p.isBuiltIn)).toBe(true);
  });

  it('returns prompts sorted alphabetically by name', async () => {
    const prompts = await getPrompts();
    const names = prompts.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('ensures system prompt exists', async () => {
    const prompts = await getPrompts();
    const system = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
    expect(system).toBeDefined();
    expect(system?.isSystem).toBe(true);
  });

  it('recreates system prompt if missing', async () => {
    // First call seeds prompts
    await getPrompts();

    // Remove system prompt from storage
    const stored = JSON.parse(mockStorage['prompts']) as Array<{ id: string }>;
    const filtered = stored.filter((p) => p.id !== SYSTEM_PROMPT_ID);
    mockStorage['prompts'] = JSON.stringify(filtered);

    const prompts = await getPrompts();
    const system = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
    expect(system).toBeDefined();
  });

  it('adds default model to prompts missing the model field', async () => {
    mockStorage['prompts'] = JSON.stringify([
      { id: 'test-1', name: 'Test', text: '{{transcript}}', isDefault: false, isSystem: false },
    ]);
    mockStorage['default_prompts_version'] = '4';

    const prompts = await getPrompts();
    const test = prompts.find((p) => p.id === 'test-1');
    expect(test?.model).toBe('openai/gpt-4o-mini');
  });
});

describe('addPrompt', () => {
  it('adds a custom prompt with valid name/text/model', async () => {
    await getPrompts(); // seed
    const newPrompt = await addPrompt('My Prompt', 'Do this: {{transcript}}', 'anthropic/claude-3.5-haiku');
    expect(newPrompt.name).toBe('My Prompt');
    expect(newPrompt.text).toBe('Do this: {{transcript}}');
    expect(newPrompt.model).toBe('anthropic/claude-3.5-haiku');
    expect(newPrompt.isSystem).toBe(false);
    expect(newPrompt.isDefault).toBe(false);
  });

  it('auto-defaults model to openai/gpt-4o-mini', async () => {
    await getPrompts(); // seed
    const newPrompt = await addPrompt('My Prompt', '{{transcript}}');
    expect(newPrompt.model).toBe('openai/gpt-4o-mini');
  });
});

describe('updatePrompt', () => {
  it('updates prompt name, text, and model', async () => {
    await getPrompts(); // seed
    const added = await addPrompt('Original', '{{transcript}}');
    await updatePrompt(added.id, { name: 'Updated', text: 'New: {{transcript}}', model: 'google/gemini-2.0-flash-001' });

    const updated = await getPromptById(added.id);
    expect(updated?.name).toBe('Updated');
    expect(updated?.text).toBe('New: {{transcript}}');
    expect(updated?.model).toBe('google/gemini-2.0-flash-001');
  });

  it('allows updating system prompt model only', async () => {
    await getPrompts(); // seed
    await updatePrompt(SYSTEM_PROMPT_ID, { model: 'anthropic/claude-3.5-haiku' });

    const system = await getPromptById(SYSTEM_PROMPT_ID);
    expect(system?.model).toBe('anthropic/claude-3.5-haiku');
  });

  it('throws when updating system prompt name', async () => {
    await getPrompts(); // seed
    await expect(updatePrompt(SYSTEM_PROMPT_ID, { name: 'New Name' })).rejects.toThrow(
      'Cannot update system prompt name or text'
    );
  });

  it('throws when updating system prompt text', async () => {
    await getPrompts(); // seed
    await expect(updatePrompt(SYSTEM_PROMPT_ID, { text: 'new text' })).rejects.toThrow(
      'Cannot update system prompt name or text'
    );
  });

  it('sets isModified when editing a built-in prompt', async () => {
    await getPrompts(); // seed
    await updatePrompt('default-detailed-summary', { name: 'My Detailed' });

    const updated = await getPromptById('default-detailed-summary');
    expect(updated?.isModified).toBe(true);
  });
});

describe('deletePrompt', () => {
  it('deletes a custom prompt', async () => {
    await getPrompts(); // seed
    const added = await addPrompt('To Delete', '{{transcript}}');
    await deletePrompt(added.id);

    const remaining = await getPrompts();
    expect(remaining.find((p) => p.id === added.id)).toBeUndefined();
  });

  it('throws when deleting system prompt', async () => {
    await getPrompts(); // seed
    await expect(deletePrompt(SYSTEM_PROMPT_ID)).rejects.toThrow('Cannot delete system prompt');
  });

  it('auto-selects new default when deleting the default prompt', async () => {
    await getPrompts(); // seed
    // Set a non-system prompt as default
    await setDefaultPromptId('default-tldr');
    await deletePrompt('default-tldr');

    const newDefaultId = await getDefaultPromptId();
    // Should be set to some prompt (the next alphabetically)
    expect(newDefaultId).toBeTruthy();
    expect(newDefaultId).not.toBe('default-tldr');
  });
});

describe('duplicatePrompt', () => {
  it('creates "Copy of" with same text/model and new ID', async () => {
    await getPrompts(); // seed
    const dupe = await duplicatePrompt('default-tldr');

    expect(dupe.name).toBe('Copy of TLDR');
    expect(dupe.id).not.toBe('default-tldr');
    expect(dupe.isSystem).toBe(false);
    expect(dupe.isDefault).toBe(false);

    const original = await getPromptById('default-tldr');
    expect(dupe.text).toBe(original?.text);
    expect(dupe.model).toBe(original?.model);
  });
});

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

describe('getDefaultPrompt', () => {
  it('returns stored default', async () => {
    await getPrompts(); // seed
    await setDefaultPromptId('default-tldr');

    const defaultPrompt = await getDefaultPrompt();
    expect(defaultPrompt.id).toBe('default-tldr');
  });

  it('falls back to system prompt if stored default not found', async () => {
    await getPrompts(); // seed
    mockStorage['default_prompt_id'] = 'nonexistent-id';

    const defaultPrompt = await getDefaultPrompt();
    expect(defaultPrompt.id).toBe(SYSTEM_PROMPT_ID);
  });
});

describe('setDefaultPromptId', () => {
  it('updates isDefault flags on all prompts', async () => {
    await getPrompts(); // seed
    await setDefaultPromptId('default-tldr');

    const prompts = await getPrompts();
    const tldr = prompts.find((p) => p.id === 'default-tldr');
    const system = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);

    expect(tldr?.isDefault).toBe(true);
    expect(system?.isDefault).toBe(false);
  });
});

describe('resetBuiltInPrompt', () => {
  it('restores original text and name', async () => {
    await getPrompts(); // seed
    await updatePrompt('default-detailed-summary', { name: 'Modified Name', text: 'Modified: {{transcript}}' });

    await resetBuiltInPrompt('default-detailed-summary');

    const prompt = await getPromptById('default-detailed-summary');
    expect(prompt?.name).toBe('Detailed Summary');
    expect(prompt?.isModified).toBe(false);
  });

  it('throws on non-built-in prompt', async () => {
    await getPrompts(); // seed
    const custom = await addPrompt('Custom', '{{transcript}}');
    await expect(resetBuiltInPrompt(custom.id)).rejects.toThrow('Can only reset built-in prompts');
  });
});

describe('migrations', () => {
  it('preserves user-modified built-ins on upgrade', async () => {
    // Seed with version 4
    await getPrompts();

    // Modify a built-in
    await updatePrompt('default-detailed-summary', { name: 'My Custom Name', text: 'Custom: {{transcript}}' });

    // Simulate version upgrade by lowering stored version
    mockStorage['default_prompts_version'] = '3';

    const prompts = await getPrompts();
    const modified = prompts.find((p) => p.id === 'default-detailed-summary');
    expect(modified?.name).toBe('My Custom Name');
    expect(modified?.isModified).toBe(true);
  });

  it('updates unmodified built-ins on upgrade', async () => {
    // Seed with version 4
    await getPrompts();

    // Simulate version upgrade by lowering stored version
    mockStorage['default_prompts_version'] = '3';

    const prompts = await getPrompts();
    // All unmodified built-ins should still have their original names
    const tldr = prompts.find((p) => p.id === 'default-tldr');
    expect(tldr?.name).toBe('TLDR');
  });
});

describe('updatePrompt - error cases', () => {
  it('throws when prompt ID not found', async () => {
    await getPrompts(); // seed
    await expect(updatePrompt('nonexistent-id', { name: 'Nope' })).rejects.toThrow(
      'Prompt with id nonexistent-id not found'
    );
  });

  it('does not set isModified when only model changes on a built-in', async () => {
    await getPrompts(); // seed
    await updatePrompt('default-detailed-summary', { model: 'anthropic/claude-3.5-haiku' });

    const updated = await getPromptById('default-detailed-summary');
    expect(updated?.model).toBe('anthropic/claude-3.5-haiku');
    expect(updated?.isModified).toBeFalsy();
  });
});

describe('deletePrompt - error cases', () => {
  it('throws when prompt ID not found', async () => {
    await getPrompts(); // seed
    await expect(deletePrompt('nonexistent-id')).rejects.toThrow(
      'Prompt with id nonexistent-id not found'
    );
  });
});

describe('duplicatePrompt - error cases', () => {
  it('throws when prompt ID not found', async () => {
    await getPrompts(); // seed
    await expect(duplicatePrompt('nonexistent-id')).rejects.toThrow(
      'Prompt with id nonexistent-id not found'
    );
  });
});

describe('getDefaultPromptId', () => {
  it('returns system prompt ID and persists it when no default is set', async () => {
    await getPrompts(); // seed (sets version, but no explicit default)
    // Clear the default prompt ID to simulate no default set
    delete mockStorage['default_prompt_id'];

    const id = await getDefaultPromptId();
    expect(id).toBe(SYSTEM_PROMPT_ID);
    // Should have persisted the default
    expect(mockStorage['default_prompt_id']).toBe(SYSTEM_PROMPT_ID);
  });
});

describe('getPromptById', () => {
  it('returns null for nonexistent ID', async () => {
    await getPrompts(); // seed
    const result = await getPromptById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns the prompt for a valid ID', async () => {
    await getPrompts(); // seed
    const result = await getPromptById(SYSTEM_PROMPT_ID);
    expect(result?.id).toBe(SYSTEM_PROMPT_ID);
    expect(result?.name).toBe('Quick Summary');
  });
});

describe('resetBuiltInPrompt', () => {
  it('preserves the model when resetting', async () => {
    await getPrompts(); // seed
    // Change both model and name
    await updatePrompt('default-detailed-summary', { model: 'anthropic/claude-3.5-haiku', name: 'Changed' });

    await resetBuiltInPrompt('default-detailed-summary');

    const prompt = await getPromptById('default-detailed-summary');
    // Name should be reset, but model should be preserved
    expect(prompt?.name).toBe('Detailed Summary');
    expect(prompt?.model).toBe('anthropic/claude-3.5-haiku');
  });
});

describe('migrations - edge cases', () => {
  it('adds missing built-in prompts on version upgrade', async () => {
    // Seed normally
    await getPrompts();

    // Remove one built-in from storage to simulate it being new in a version
    const stored = JSON.parse(mockStorage['prompts']) as Array<{ id: string }>;
    const withoutTldr = stored.filter((p) => p.id !== 'default-tldr');
    mockStorage['prompts'] = JSON.stringify(withoutTldr);

    // Lower version to trigger migration
    mockStorage['default_prompts_version'] = '3';

    const prompts = await getPrompts();
    const tldr = prompts.find((p) => p.id === 'default-tldr');
    expect(tldr).toBeDefined();
    expect(tldr?.name).toBe('TLDR');
  });
});

describe('generatePromptId', () => {
  it('returns a UUID string', () => {
    const id = generatePromptId();
    expect(id).toBe('test-uuid-1');
  });
});
