import { Preferences } from '@capacitor/preferences';
import type { Prompt } from '../types/prompt';
export type { ValidationResult } from '../types/prompt';
import { SYSTEM_PROMPT_ID } from '../types/prompt';
import { config } from '../config';
import DEFAULT_PROMPTS from '../data/defaultPrompts.json';
import {
  createSystemPrompt,
  migrateLegacyPrompts,
  mergeDefaultPrompts,
  ensureSystemPrompt,
  fillMissingModels,
} from './promptMigrations';

const DEFAULT_MODEL_ID = config.defaultModel;
const DEFAULT_PROMPTS_VERSION = 4;

const STORAGE_KEYS = {
  PROMPTS: 'prompts',
  DEFAULT_PROMPT_ID: 'default_prompt_id',
  DEFAULT_PROMPTS_VERSION: 'default_prompts_version',
};

export function generatePromptId(): string {
  return crypto.randomUUID();
}

async function getStoredVersion(): Promise<number> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.DEFAULT_PROMPTS_VERSION });
  return value ? parseInt(value, 10) : 0;
}

async function setStoredVersion(version: number): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.DEFAULT_PROMPTS_VERSION, value: String(version) });
}

async function loadRawPrompts(): Promise<Prompt[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.PROMPTS });
  return value ? JSON.parse(value) as Prompt[] : [];
}

export async function getPrompts(): Promise<Prompt[]> {
  let prompts = await loadRawPrompts();
  const { value: storedDefaultId } = await Preferences.get({ key: STORAGE_KEYS.DEFAULT_PROMPT_ID });
  let needsSave = false;

  const storedVersion = await getStoredVersion();

  if (storedVersion < DEFAULT_PROMPTS_VERSION) {
    const migration = migrateLegacyPrompts(prompts, storedDefaultId ?? undefined);
    prompts = migration.prompts;
    if (migration.migrated) {
      needsSave = true;
    }

    let effectiveDefaultId = storedDefaultId ?? undefined;
    if (migration.newDefaultId) {
      effectiveDefaultId = migration.newDefaultId;
      await Preferences.set({ key: STORAGE_KEYS.DEFAULT_PROMPT_ID, value: migration.newDefaultId });
    }

    if (mergeDefaultPrompts(prompts, effectiveDefaultId)) {
      needsSave = true;
    }

    await setStoredVersion(DEFAULT_PROMPTS_VERSION);
  }

  if (ensureSystemPrompt(prompts, storedDefaultId)) {
    needsSave = true;
  }

  if (fillMissingModels(prompts)) {
    needsSave = true;
  }

  if (needsSave) {
    await savePrompts(prompts);
  }

  return prompts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePrompts(prompts: Prompt[]): Promise<void> {
  await Preferences.set({
    key: STORAGE_KEYS.PROMPTS,
    value: JSON.stringify(prompts),
  });
}

export async function getDefaultPromptId(): Promise<string> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.DEFAULT_PROMPT_ID });
  if (value) {
    return value;
  }

  await setDefaultPromptId(SYSTEM_PROMPT_ID);
  return SYSTEM_PROMPT_ID;
}

export async function setDefaultPromptId(promptId: string): Promise<void> {
  const prompts = await loadRawPrompts();

  const updatedPrompts = prompts.map((p) => ({
    ...p,
    isDefault: p.id === promptId,
  }));

  await Preferences.set({ key: STORAGE_KEYS.DEFAULT_PROMPT_ID, value: promptId });
  await savePrompts(updatedPrompts);
}

export async function getDefaultPrompt(): Promise<Prompt> {
  const prompts = await loadRawPrompts();
  const defaultId = await getDefaultPromptId();

  const defaultPrompt = prompts.find((p) => p.id === defaultId);
  if (defaultPrompt) {
    return defaultPrompt;
  }

  const systemPrompt = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
  return systemPrompt ?? createSystemPrompt();
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const prompts = await loadRawPrompts();
  return prompts.find((p) => p.id === id) ?? null;
}

export async function addPrompt(
  name: string,
  text: string,
  model: string = DEFAULT_MODEL_ID
): Promise<Prompt> {
  const prompts = await loadRawPrompts();

  const newPrompt: Prompt = {
    id: generatePromptId(),
    name,
    text,
    model,
    isDefault: false,
    isSystem: false,
  };

  prompts.push(newPrompt);
  await savePrompts(prompts);

  return newPrompt;
}

export async function updatePrompt(
  id: string,
  updates: Partial<Pick<Prompt, 'name' | 'text' | 'model'>>
): Promise<void> {
  const prompts = await loadRawPrompts();
  const index = prompts.findIndex((p) => p.id === id);
  const prompt = prompts[index];

  if (index === -1 || !prompt) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  if (prompt.isSystem) {
    if (updates.name !== undefined || updates.text !== undefined) {
      throw new Error('Cannot update system prompt name or text');
    }
    if (updates.model !== undefined) {
      prompts[index] = { ...prompt, model: updates.model };
      await savePrompts(prompts);
    }
    return;
  }

  // Track modifications for built-in prompts
  const isBuiltIn = prompt.isBuiltIn;
  const nameChanged = updates.name !== undefined && updates.name !== prompt.name;
  const textChanged = updates.text !== undefined && updates.text !== prompt.text;

  prompts[index] = {
    ...prompt,
    ...updates,
    ...(isBuiltIn && (nameChanged || textChanged) ? { isModified: true } : {}),
  };
  await savePrompts(prompts);
}

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await loadRawPrompts();
  const promptToDelete = prompts.find((p) => p.id === id);

  if (!promptToDelete) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  if (promptToDelete.isSystem) {
    throw new Error('Cannot delete system prompt');
  }

  const filteredPrompts = prompts.filter((p) => p.id !== id);

  if (promptToDelete.isDefault) {
    const sorted = filteredPrompts.sort((a, b) => a.name.localeCompare(b.name));
    const newDefault = sorted[0];
    if (newDefault) {
      newDefault.isDefault = true;
      await Preferences.set({ key: STORAGE_KEYS.DEFAULT_PROMPT_ID, value: newDefault.id });
    }
  }

  await savePrompts(filteredPrompts);
}

export async function duplicatePrompt(id: string): Promise<Prompt> {
  const prompts = await loadRawPrompts();
  const original = prompts.find((p) => p.id === id);

  if (!original) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  const newPrompt: Prompt = {
    id: generatePromptId(),
    name: `Copy of ${original.name}`,
    text: original.text,
    model: original.model,
    isDefault: false,
    isSystem: false,
  };

  prompts.push(newPrompt);
  await savePrompts(prompts);

  return newPrompt;
}

export async function resetBuiltInPrompt(id: string): Promise<void> {
  const prompts = await loadRawPrompts();
  const index = prompts.findIndex((p) => p.id === id);
  const prompt = prompts[index];

  if (index === -1 || !prompt) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  if (!prompt.isBuiltIn) {
    throw new Error('Can only reset built-in prompts');
  }

  const def = DEFAULT_PROMPTS.find((d) => d.id === id);
  if (!def) {
    throw new Error(`No default definition found for prompt ${id}`);
  }

  prompts[index] = {
    ...prompt,
    name: def.name,
    text: def.text,
    isModified: false,
  };
  await savePrompts(prompts);
}

export { validatePromptText, validatePromptName } from './promptValidation';
