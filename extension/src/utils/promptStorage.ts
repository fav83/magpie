import type { Prompt } from '../types/prompt';
import { SYSTEM_PROMPT_ID } from '../types/prompt';
import { DEFAULT_PROMPTS, DEFAULT_PROMPTS_VERSION, STORAGE_KEYS } from '../config';
import { DEFAULT_MODEL_ID } from '../types/models';

/** Old system prompt ID for migration */
const LEGACY_SYSTEM_PROMPT_ID = 'system-default';

/** Old default summary prompt ID (replaced in v2 with quick-summary and detailed-summary) */
const OLD_DEFAULT_SUMMARY_ID = 'default-summary';

/**
 * Convert a default prompt definition to a Prompt object.
 */
function definitionToPrompt(def: typeof DEFAULT_PROMPTS[number], isDefault = false): Prompt {
  return {
    id: def.id,
    name: def.name,
    text: def.text,
    model: def.model,
    isDefault,
    isSystem: def.isSystem,
    isBuiltIn: true,
  };
}

/**
 * Create all default prompts from the definition.
 * @param defaultPromptId - The current default prompt ID (to set isDefault correctly)
 */
function createDefaultPrompts(defaultPromptId?: string): Prompt[] {
  // If no defaultPromptId specified, default to system prompt
  const effectiveDefaultId = defaultPromptId ?? SYSTEM_PROMPT_ID;
  return DEFAULT_PROMPTS.map((def) =>
    definitionToPrompt(def, def.id === effectiveDefaultId)
  );
}

/**
 * Create the system prompt from default definition (fallback).
 */
function createSystemPrompt(): Prompt {
  const systemDef = DEFAULT_PROMPTS.find((d) => d.id === SYSTEM_PROMPT_ID);
  if (systemDef) {
    return definitionToPrompt(systemDef, true);
  }
  // Fallback if somehow the system prompt definition is missing
  return {
    id: SYSTEM_PROMPT_ID,
    name: 'Quick Summary',
    text: DEFAULT_PROMPTS[0]?.text ?? '{{transcript}}',
    model: DEFAULT_MODEL_ID,
    isDefault: true,
    isSystem: true,
    isBuiltIn: true,
  };
}

export function generatePromptId(): string {
  return crypto.randomUUID();
}

/**
 * Get the stored default prompts version.
 */
async function getStoredVersion(): Promise<number> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.DEFAULT_PROMPTS_VERSION]);
  return (result[STORAGE_KEYS.DEFAULT_PROMPTS_VERSION] as number | undefined) ?? 0;
}

/**
 * Set the stored default prompts version.
 */
async function setStoredVersion(version: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_PROMPTS_VERSION]: version });
}

/**
 * Migrate from old single system prompt to new default prompts.
 * Also handles v1->v2 migration of default-summary to quick-summary + detailed-summary.
 */
function migrateLegacyPrompts(
  prompts: Prompt[],
  storedDefaultId: string | undefined
): { prompts: Prompt[]; migrated: boolean; newDefaultId: string | undefined } {
  let migrated = false;
  let newDefaultId: string | undefined;

  // Find and remove old system prompt (very old migration)
  const legacyIndex = prompts.findIndex((p) => p.id === LEGACY_SYSTEM_PROMPT_ID);
  if (legacyIndex !== -1) {
    prompts.splice(legacyIndex, 1);
    migrated = true;
  }

  // v1->v2: Remove old default-summary (replaced by detailed-summary)
  const oldSummaryIndex = prompts.findIndex((p) => p.id === OLD_DEFAULT_SUMMARY_ID);
  if (oldSummaryIndex !== -1) {
    prompts.splice(oldSummaryIndex, 1);
    migrated = true;

    // If user had old default-summary as their default, switch to new system prompt
    if (storedDefaultId === OLD_DEFAULT_SUMMARY_ID) {
      newDefaultId = SYSTEM_PROMPT_ID;
    }
  }

  return { prompts, migrated, newDefaultId };
}

export async function getPrompts(): Promise<Prompt[]> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.PROMPTS, STORAGE_KEYS.DEFAULT_PROMPT_ID]);
  let prompts = (result[STORAGE_KEYS.PROMPTS] as Prompt[] | undefined) ?? [];
  const storedDefaultId = result[STORAGE_KEYS.DEFAULT_PROMPT_ID] as string | undefined;
  let needsSave = false;

  // Check stored version
  const storedVersion = await getStoredVersion();

  // First time install or upgrade needed
  if (storedVersion < DEFAULT_PROMPTS_VERSION) {
    // Migrate legacy prompts if needed
    const migration = migrateLegacyPrompts(prompts, storedDefaultId);
    prompts = migration.prompts;
    if (migration.migrated) {
      needsSave = true;
    }

    // Update default prompt ID if migration changed it
    let effectiveDefaultId = storedDefaultId;
    if (migration.newDefaultId) {
      effectiveDefaultId = migration.newDefaultId;
      await chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_PROMPT_ID]: migration.newDefaultId });
    }

    // Add any missing default prompts, respecting the effective default prompt ID
    const defaultPrompts = createDefaultPrompts(effectiveDefaultId);
    for (const defaultPrompt of defaultPrompts) {
      const exists = prompts.some((p) => p.id === defaultPrompt.id);
      if (!exists) {
        prompts.push(defaultPrompt);
        needsSave = true;
      }
    }

    // Update stored version
    await setStoredVersion(DEFAULT_PROMPTS_VERSION);
  }

  // Ensure system prompt always exists (safety check)
  const hasSystemPrompt = prompts.some((p) => p.id === SYSTEM_PROMPT_ID);
  if (!hasSystemPrompt) {
    const systemDef = DEFAULT_PROMPTS.find((d) => d.id === SYSTEM_PROMPT_ID);
    if (systemDef) {
      // Only mark as default if no other default is stored
      const isDefault = !storedDefaultId || storedDefaultId === SYSTEM_PROMPT_ID;
      prompts.unshift({
        id: systemDef.id,
        name: systemDef.name,
        text: systemDef.text,
        model: systemDef.model,
        isDefault,
        isSystem: true,
        isBuiltIn: true,
      });
      needsSave = true;
    }
  }

  // Migrate prompts without model field (legacy prompts)
  for (const prompt of prompts) {
    if (!prompt.model) {
      prompt.model = DEFAULT_MODEL_ID;
      needsSave = true;
    }
  }

  if (needsSave) {
    await savePrompts(prompts);
  }

  // Sort alphabetically by name
  return prompts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePrompts(prompts: Prompt[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
}

export async function getDefaultPromptId(): Promise<string> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.DEFAULT_PROMPT_ID]);
  const defaultId = result[STORAGE_KEYS.DEFAULT_PROMPT_ID] as string | undefined;

  if (defaultId) {
    return defaultId;
  }

  // If no default set, use system prompt
  await setDefaultPromptId(SYSTEM_PROMPT_ID);
  return SYSTEM_PROMPT_ID;
}

export async function setDefaultPromptId(promptId: string): Promise<void> {
  const prompts = await getPrompts();

  // Update isDefault flags
  const updatedPrompts = prompts.map((p) => ({
    ...p,
    isDefault: p.id === promptId,
  }));

  await Promise.all([
    chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_PROMPT_ID]: promptId }),
    savePrompts(updatedPrompts),
  ]);
}

export async function getDefaultPrompt(): Promise<Prompt> {
  const prompts = await getPrompts();
  const defaultId = await getDefaultPromptId();

  const defaultPrompt = prompts.find((p) => p.id === defaultId);
  if (defaultPrompt) {
    return defaultPrompt;
  }

  // Fallback to system prompt
  const systemPrompt = prompts.find((p) => p.id === SYSTEM_PROMPT_ID);
  return systemPrompt ?? createSystemPrompt();
}

/**
 * Get the default prompt ID and its associated model ID.
 * Convenience function to avoid duplicate logic across components.
 */
export async function getDefaultPromptAndModel(): Promise<{ promptId: string; modelId: string }> {
  const prompt = await getDefaultPrompt();
  return { promptId: prompt.id, modelId: prompt.model };
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const prompts = await getPrompts();
  return prompts.find((p) => p.id === id) ?? null;
}

export async function addPrompt(
  name: string,
  text: string,
  model: string = DEFAULT_MODEL_ID
): Promise<Prompt> {
  const prompts = await getPrompts();

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
  const prompts = await getPrompts();
  const index = prompts.findIndex((p) => p.id === id);
  const prompt = prompts[index];

  if (index === -1 || !prompt) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  // System prompt can only update model
  if (prompt.isSystem) {
    if (updates.name !== undefined || updates.text !== undefined) {
      throw new Error('Cannot update system prompt name or text');
    }
    // Allow model update for system prompt
    if (updates.model !== undefined) {
      prompts[index] = { ...prompt, model: updates.model };
      await savePrompts(prompts);
    }
    return;
  }

  prompts[index] = { ...prompt, ...updates };
  await savePrompts(prompts);
}

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await getPrompts();
  const promptToDelete = prompts.find((p) => p.id === id);

  if (!promptToDelete) {
    throw new Error(`Prompt with id ${id} not found`);
  }

  // Cannot delete system prompt
  if (promptToDelete.isSystem) {
    throw new Error('Cannot delete system prompt');
  }

  const filteredPrompts = prompts.filter((p) => p.id !== id);

  // If we're deleting the default, auto-select next alphabetically
  if (promptToDelete.isDefault) {
    const sorted = filteredPrompts.sort((a, b) => a.name.localeCompare(b.name));
    const newDefault = sorted[0];
    if (newDefault) {
      newDefault.isDefault = true;
      await chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_PROMPT_ID]: newDefault.id });
    }
  }

  await savePrompts(filteredPrompts);
}

export async function duplicatePrompt(id: string): Promise<Prompt> {
  const prompts = await getPrompts();
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

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

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
