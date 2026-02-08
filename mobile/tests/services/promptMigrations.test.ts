import { describe, it, expect } from 'vitest';
import {
  createDefaultPrompts,
  createSystemPrompt,
  migrateLegacyPrompts,
  mergeDefaultPrompts,
  ensureSystemPrompt,
  fillMissingModels,
} from '../../src/services/promptMigrations';
import { SYSTEM_PROMPT_ID } from '../../src/types/prompt';
import type { Prompt } from '../../src/types/prompt';

function makePrompt(overrides: Partial<Prompt> & { id: string }): Prompt {
  return {
    name: 'Test',
    text: '{{transcript}}',
    model: 'openai/gpt-4o-mini',
    isDefault: false,
    isSystem: false,
    ...overrides,
  };
}

describe('createDefaultPrompts', () => {
  it('returns all 14 built-in prompts', () => {
    const prompts = createDefaultPrompts();
    expect(prompts).toHaveLength(14);
    expect(prompts.every((p) => p.isBuiltIn)).toBe(true);
  });

  it('marks system prompt as default when no defaultPromptId given', () => {
    const prompts = createDefaultPrompts();
    const system = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
    expect(system?.isDefault).toBe(true);

    const nonSystem = prompts.filter((p) => p.id !== SYSTEM_PROMPT_ID);
    expect(nonSystem.every((p) => !p.isDefault)).toBe(true);
  });

  it('marks the given prompt as default', () => {
    const prompts = createDefaultPrompts('default-tldr');
    const tldr = prompts.find((p) => p.id === 'default-tldr');
    expect(tldr?.isDefault).toBe(true);

    const system = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
    expect(system?.isDefault).toBe(false);
  });
});

describe('createSystemPrompt', () => {
  it('returns a system prompt with isDefault and isSystem true', () => {
    const prompt = createSystemPrompt();
    expect(prompt.id).toBe(SYSTEM_PROMPT_ID);
    expect(prompt.isDefault).toBe(true);
    expect(prompt.isSystem).toBe(true);
    expect(prompt.isBuiltIn).toBe(true);
    expect(prompt.name).toBe('Quick Summary');
  });
});

describe('migrateLegacyPrompts', () => {
  it('removes system-default legacy prompt', () => {
    const prompts = [
      makePrompt({ id: 'system-default', name: 'Old System' }),
      makePrompt({ id: 'custom-1', name: 'Custom' }),
    ];

    const result = migrateLegacyPrompts(prompts, undefined);
    expect(result.migrated).toBe(true);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].id).toBe('custom-1');
    expect(result.newDefaultId).toBeUndefined();
  });

  it('removes default-summary legacy prompt', () => {
    const prompts = [
      makePrompt({ id: 'default-summary', name: 'Old Summary' }),
      makePrompt({ id: 'custom-1', name: 'Custom' }),
    ];

    const result = migrateLegacyPrompts(prompts, undefined);
    expect(result.migrated).toBe(true);
    expect(result.prompts).toHaveLength(1);
  });

  it('updates default ID when default-summary was the default', () => {
    const prompts = [
      makePrompt({ id: 'default-summary', name: 'Old Summary' }),
    ];

    const result = migrateLegacyPrompts(prompts, 'default-summary');
    expect(result.newDefaultId).toBe(SYSTEM_PROMPT_ID);
  });

  it('returns migrated=false when no legacy prompts found', () => {
    const prompts = [makePrompt({ id: 'custom-1', name: 'Custom' })];

    const result = migrateLegacyPrompts(prompts, undefined);
    expect(result.migrated).toBe(false);
    expect(result.prompts).toHaveLength(1);
    expect(result.newDefaultId).toBeUndefined();
  });

  it('removes both legacy prompts when present', () => {
    const prompts = [
      makePrompt({ id: 'system-default' }),
      makePrompt({ id: 'default-summary' }),
      makePrompt({ id: 'keeper' }),
    ];

    const result = migrateLegacyPrompts(prompts, undefined);
    expect(result.migrated).toBe(true);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].id).toBe('keeper');
  });
});

describe('mergeDefaultPrompts', () => {
  it('adds missing built-in prompts', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: SYSTEM_PROMPT_ID, isSystem: true, isBuiltIn: true }),
    ];

    const changed = mergeDefaultPrompts(prompts, SYSTEM_PROMPT_ID);
    expect(changed).toBe(true);
    expect(prompts.length).toBe(14);
  });

  it('refreshes unmodified built-ins to latest definition', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: 'default-tldr', name: 'Old Name', isBuiltIn: true }),
    ];

    const changed = mergeDefaultPrompts(prompts, undefined);
    expect(changed).toBe(true);
    expect(prompts.find((p) => p.id === 'default-tldr')?.name).toBe('TLDR');
  });

  it('preserves user-modified built-ins', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: 'default-tldr', name: 'My Custom TLDR', isBuiltIn: true, isModified: true }),
    ];

    mergeDefaultPrompts(prompts, undefined);
    expect(prompts.find((p) => p.id === 'default-tldr')?.name).toBe('My Custom TLDR');
  });

  it('returns false when all built-ins already exist and are modified', () => {
    // Start with all 14 prompts, all marked as modified
    const prompts = createDefaultPrompts().map((p) => ({ ...p, isModified: true }));
    const changed = mergeDefaultPrompts(prompts, SYSTEM_PROMPT_ID);
    expect(changed).toBe(false);
  });
});

describe('ensureSystemPrompt', () => {
  it('inserts system prompt at front when missing', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: 'custom-1' }),
    ];

    const changed = ensureSystemPrompt(prompts, null);
    expect(changed).toBe(true);
    expect(prompts[0].id).toBe(SYSTEM_PROMPT_ID);
    expect(prompts[0].isSystem).toBe(true);
    expect(prompts[0].isDefault).toBe(true);
  });

  it('marks system prompt as non-default when another default is stored', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: 'custom-1' }),
    ];

    ensureSystemPrompt(prompts, 'custom-1');
    expect(prompts[0].id).toBe(SYSTEM_PROMPT_ID);
    expect(prompts[0].isDefault).toBe(false);
  });

  it('returns false when system prompt already exists', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: SYSTEM_PROMPT_ID, isSystem: true }),
    ];

    const changed = ensureSystemPrompt(prompts, null);
    expect(changed).toBe(false);
    expect(prompts).toHaveLength(1);
  });
});

describe('fillMissingModels', () => {
  it('fills in default model for prompts without one', () => {
    const prompts: Prompt[] = [
      { id: 'test-1', name: 'Test', text: '{{transcript}}', model: '', isDefault: false, isSystem: false },
    ];

    const changed = fillMissingModels(prompts);
    expect(changed).toBe(true);
    expect(prompts[0].model).toBe('openai/gpt-4o-mini');
  });

  it('does not change prompts that already have a model', () => {
    const prompts: Prompt[] = [
      makePrompt({ id: 'test-1', model: 'anthropic/claude-3.5-haiku' }),
    ];

    const changed = fillMissingModels(prompts);
    expect(changed).toBe(false);
    expect(prompts[0].model).toBe('anthropic/claude-3.5-haiku');
  });

  it('returns false for empty array', () => {
    const changed = fillMissingModels([]);
    expect(changed).toBe(false);
  });
});
