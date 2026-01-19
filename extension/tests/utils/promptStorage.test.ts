import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePromptId,
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
  validatePromptText,
  validatePromptName,
} from '../../src/utils/promptStorage';
import { SYSTEM_PROMPT_ID } from '../../src/types/prompt';
import type { Prompt } from '../../src/types/prompt';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};
const mockGet = vi.fn((keys: string[]) => {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in mockStorage) {
      result[key] = mockStorage[key];
    }
  }
  return Promise.resolve(result);
});
const mockSet = vi.fn((data: Record<string, unknown>) => {
  Object.assign(mockStorage, data);
  return Promise.resolve();
});

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
    },
  },
});

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'mock-uuid-1234'),
});

describe('promptStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe('generatePromptId', () => {
    it('should generate a UUID', () => {
      const id = generatePromptId();
      expect(id).toBe('mock-uuid-1234');
    });
  });

  describe('getPrompts', () => {
    it('should return default prompts when no prompts exist', async () => {
      const prompts = await getPrompts();

      // Should have all default prompts (11 total)
      expect(prompts.length).toBeGreaterThanOrEqual(1);
      // System prompt should exist
      const systemPrompt = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt!.name).toBe('Quick Summary');
      expect(systemPrompt!.isSystem).toBe(true);
    });

    it('should return existing prompts sorted alphabetically', async () => {
      mockStorage.prompts = [
        { id: '1', name: 'Zebra', text: '{{transcript}}', isDefault: false, isSystem: false },
        { id: SYSTEM_PROMPT_ID, name: 'Quick Summary', text: '{{transcript}}', isDefault: true, isSystem: true, isBuiltIn: true },
        { id: '2', name: 'Apple', text: '{{transcript}}', isDefault: false, isSystem: false },
      ];
      // Set version to current to prevent migration from adding more prompts
      mockStorage.defaultPromptsVersion = 4;

      const prompts = await getPrompts();

      expect(prompts).toHaveLength(3);
      expect(prompts[0]!.name).toBe('Apple');
      expect(prompts[1]!.name).toBe('Quick Summary');
      expect(prompts[2]!.name).toBe('Zebra');
    });

    it('should add system prompt if missing from stored prompts', async () => {
      mockStorage.prompts = [
        { id: '1', name: 'Custom', text: '{{transcript}}', isDefault: true, isSystem: false },
      ];
      // Set version to current to prevent all default prompts from being added
      mockStorage.defaultPromptsVersion = 4;

      const prompts = await getPrompts();

      // Should have added system prompt since it was missing
      expect(prompts.some((p) => p.id === SYSTEM_PROMPT_ID)).toBe(true);
    });

    it('should migrate legacy prompts without model field', async () => {
      // Legacy prompts don't have a model field
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Quick Summary', text: '{{transcript}}', isDefault: true, isSystem: true, isBuiltIn: true },
        { id: '1', name: 'Legacy Prompt', text: '{{transcript}}', isDefault: false, isSystem: false },
      ];
      // Set version to current to prevent additional default prompts from being added
      mockStorage.defaultPromptsVersion = 4;

      const prompts = await getPrompts();

      // All prompts should now have a model field
      expect(prompts).toHaveLength(2);
      expect(prompts[0]!.model).toBe('openai/gpt-4o-mini');
      expect(prompts[1]!.model).toBe('openai/gpt-4o-mini');

      // Should have saved the migrated prompts
      expect(mockSet).toHaveBeenCalled();
    });

    it('should not re-save prompts that already have model field', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Quick Summary', text: '{{transcript}}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true, isBuiltIn: true },
        { id: '1', name: 'Custom', text: '{{transcript}}', model: 'anthropic/claude-3.5-sonnet', isDefault: false, isSystem: false },
      ];
      // Set version to current to prevent migration from adding default prompts
      mockStorage.defaultPromptsVersion = 4;

      await getPrompts();

      // Should not have saved (no migration needed)
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('savePrompts', () => {
    it('should save prompts to storage', async () => {
      const prompts: Prompt[] = [
        { id: '1', name: 'Test', text: '{transcript}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: false },
      ];

      await savePrompts(prompts);

      expect(mockSet).toHaveBeenCalledWith({ prompts });
    });
  });

  describe('getDefaultPromptId', () => {
    it('should return stored default prompt ID', async () => {
      mockStorage.defaultPromptId = 'custom-id';

      const id = await getDefaultPromptId();

      expect(id).toBe('custom-id');
    });

    it('should return system prompt ID when no default is set', async () => {
      const id = await getDefaultPromptId();

      expect(id).toBe(SYSTEM_PROMPT_ID);
      expect(mockSet).toHaveBeenCalledWith({ defaultPromptId: SYSTEM_PROMPT_ID });
    });
  });

  describe('setDefaultPromptId', () => {
    it('should update default prompt ID and isDefault flags', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
        { id: 'custom', name: 'Custom', text: '{transcript}', isDefault: false, isSystem: false },
      ];

      await setDefaultPromptId('custom');

      expect(mockSet).toHaveBeenCalledWith({ defaultPromptId: 'custom' });
      // Check that prompts were updated with new isDefault flags
      const savedPrompts = mockStorage.prompts as Prompt[];
      expect(savedPrompts.find((p) => p.id === 'custom')?.isDefault).toBe(true);
      expect(savedPrompts.find((p) => p.id === SYSTEM_PROMPT_ID)?.isDefault).toBe(false);
    });
  });

  describe('getDefaultPrompt', () => {
    it('should return the default prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: false, isSystem: true },
        { id: 'custom', name: 'Custom', text: 'Custom {transcript}', isDefault: true, isSystem: false },
      ];
      mockStorage.defaultPromptId = 'custom';

      const prompt = await getDefaultPrompt();

      expect(prompt.id).toBe('custom');
      expect(prompt.name).toBe('Custom');
    });

    it('should fallback to system prompt if default not found', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];
      mockStorage.defaultPromptId = 'non-existent';

      const prompt = await getDefaultPrompt();

      expect(prompt.id).toBe(SYSTEM_PROMPT_ID);
    });
  });

  describe('getPromptById', () => {
    it('should return prompt by ID', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
        { id: 'custom', name: 'Custom', text: 'Custom {transcript}', isDefault: false, isSystem: false },
      ];

      const prompt = await getPromptById('custom');

      expect(prompt?.id).toBe('custom');
      expect(prompt?.name).toBe('Custom');
    });

    it('should return null for non-existent ID', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      const prompt = await getPromptById('non-existent');

      expect(prompt).toBeNull();
    });
  });

  describe('addPrompt', () => {
    it('should add a new prompt with generated ID', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      const newPrompt = await addPrompt('My Prompt', 'Summarize: {transcript}');

      expect(newPrompt.id).toBe('mock-uuid-1234');
      expect(newPrompt.name).toBe('My Prompt');
      expect(newPrompt.text).toBe('Summarize: {transcript}');
      expect(newPrompt.isDefault).toBe(false);
      expect(newPrompt.isSystem).toBe(false);
    });

    it('should use default model when not specified', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true },
      ];

      const newPrompt = await addPrompt('My Prompt', 'Summarize: {transcript}');

      expect(newPrompt.model).toBe('openai/gpt-4o-mini');
    });

    it('should use provided model when specified', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true },
      ];

      const newPrompt = await addPrompt('My Prompt', 'Summarize: {transcript}', 'anthropic/claude-3.5-sonnet');

      expect(newPrompt.model).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('updatePrompt', () => {
    it('should update prompt name and text', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true },
        { id: 'custom', name: 'Old Name', text: 'Old {transcript}', model: 'openai/gpt-4o-mini', isDefault: false, isSystem: false },
      ];

      await updatePrompt('custom', { name: 'New Name', text: 'New {transcript}' });

      const savedPrompts = mockStorage.prompts as Prompt[];
      const updated = savedPrompts.find((p) => p.id === 'custom');
      expect(updated?.name).toBe('New Name');
      expect(updated?.text).toBe('New {transcript}');
    });

    it('should update prompt model', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true },
        { id: 'custom', name: 'Custom', text: '{transcript}', model: 'openai/gpt-4o-mini', isDefault: false, isSystem: false },
      ];

      await updatePrompt('custom', { model: 'anthropic/claude-3.5-sonnet' });

      const savedPrompts = mockStorage.prompts as Prompt[];
      const updated = savedPrompts.find((p) => p.id === 'custom');
      expect(updated?.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should throw error for non-existent prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      await expect(updatePrompt('non-existent', { name: 'New' })).rejects.toThrow(
        'Prompt with id non-existent not found'
      );
    });

    it('should throw error when trying to update system prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      await expect(updatePrompt(SYSTEM_PROMPT_ID, { name: 'New' })).rejects.toThrow(
        'Cannot update system prompt'
      );
    });
  });

  describe('deletePrompt', () => {
    it('should delete a prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Quick Summary', text: '{{transcript}}', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true, isBuiltIn: true },
        { id: 'custom', name: 'Custom', text: '{{transcript}}', model: 'openai/gpt-4o-mini', isDefault: false, isSystem: false },
      ];
      mockStorage.defaultPromptsVersion = 4;

      await deletePrompt('custom');

      const savedPrompts = mockStorage.prompts as Prompt[];
      expect(savedPrompts).toHaveLength(1);
      expect(savedPrompts.find((p) => p.id === 'custom')).toBeUndefined();
    });

    it('should auto-select new default when deleting default prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: false, isSystem: true },
        { id: 'custom1', name: 'AAA First', text: '{transcript}', isDefault: true, isSystem: false },
        { id: 'custom2', name: 'BBB Second', text: '{transcript}', isDefault: false, isSystem: false },
      ];

      await deletePrompt('custom1');

      // Should have set BBB Second or Default Summary as new default (alphabetically first)
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPromptId: expect.any(String) })
      );
    });

    it('should throw error for non-existent prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      await expect(deletePrompt('non-existent')).rejects.toThrow(
        'Prompt with id non-existent not found'
      );
    });

    it('should throw error when trying to delete system prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      await expect(deletePrompt(SYSTEM_PROMPT_ID)).rejects.toThrow(
        'Cannot delete system prompt'
      );
    });
  });

  describe('duplicatePrompt', () => {
    it('should create a copy of the prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
        { id: 'original', name: 'Original', text: 'Original {transcript}', isDefault: false, isSystem: false },
      ];

      const duplicate = await duplicatePrompt('original');

      expect(duplicate.id).toBe('mock-uuid-1234');
      expect(duplicate.name).toBe('Copy of Original');
      expect(duplicate.text).toBe('Original {transcript}');
      expect(duplicate.isDefault).toBe(false);
      expect(duplicate.isSystem).toBe(false);
    });

    it('should be able to duplicate system prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: 'System {transcript}', isDefault: true, isSystem: true },
      ];

      const duplicate = await duplicatePrompt(SYSTEM_PROMPT_ID);

      expect(duplicate.name).toBe('Copy of Default Summary');
      expect(duplicate.text).toBe('System {transcript}');
      expect(duplicate.isSystem).toBe(false);
    });

    it('should throw error for non-existent prompt', async () => {
      mockStorage.prompts = [
        { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: '{transcript}', isDefault: true, isSystem: true },
      ];

      await expect(duplicatePrompt('non-existent')).rejects.toThrow(
        'Prompt with id non-existent not found'
      );
    });
  });

  describe('validatePromptText', () => {
    it('should return valid for text containing {{transcript}}', () => {
      const result = validatePromptText('Summarize this: {{transcript}}');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for text without {{transcript}}', () => {
      const result = validatePromptText('Summarize this video');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Prompt must include {{transcript}} placeholder.');
      }
    });
  });

  describe('validatePromptName', () => {
    it('should return valid for non-empty name', () => {
      const result = validatePromptName('My Prompt');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for empty name', () => {
      const result = validatePromptName('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Prompt name cannot be empty.');
      }
    });

    it('should return invalid for whitespace-only name', () => {
      const result = validatePromptName('   ');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Prompt name cannot be empty.');
      }
    });
  });
});
