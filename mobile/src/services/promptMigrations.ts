import type { Prompt } from '../types/prompt';
import { SYSTEM_PROMPT_ID } from '../types/prompt';
import { config } from '../config';
import DEFAULT_PROMPTS from '../data/defaultPrompts.json';

const DEFAULT_MODEL_ID = config.defaultModel;

/** Old system prompt ID for migration */
const LEGACY_SYSTEM_PROMPT_ID = 'system-default';

/** Old default summary prompt ID (replaced in v2) */
const OLD_DEFAULT_SUMMARY_ID = 'default-summary';

type DefaultPromptDef = (typeof DEFAULT_PROMPTS)[number];

function definitionToPrompt(def: DefaultPromptDef, isDefault = false): Prompt {
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

export function createDefaultPrompts(defaultPromptId?: string): Prompt[] {
  const effectiveDefaultId = defaultPromptId ?? SYSTEM_PROMPT_ID;
  return DEFAULT_PROMPTS.map((def) =>
    definitionToPrompt(def, def.id === effectiveDefaultId)
  );
}

export function createSystemPrompt(): Prompt {
  const systemDef = DEFAULT_PROMPTS.find((d) => d.id === SYSTEM_PROMPT_ID);
  if (systemDef) {
    return definitionToPrompt(systemDef, true);
  }
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

/**
 * Removes legacy prompt IDs that were renamed in earlier versions.
 * Returns whether anything changed and if the default ID needs updating.
 */
export function migrateLegacyPrompts(
  prompts: Prompt[],
  storedDefaultId: string | undefined
): { prompts: Prompt[]; migrated: boolean; newDefaultId: string | undefined } {
  let migrated = false;
  let newDefaultId: string | undefined;

  const legacyIndex = prompts.findIndex((p) => p.id === LEGACY_SYSTEM_PROMPT_ID);
  if (legacyIndex !== -1) {
    prompts.splice(legacyIndex, 1);
    migrated = true;
  }

  const oldSummaryIndex = prompts.findIndex((p) => p.id === OLD_DEFAULT_SUMMARY_ID);
  if (oldSummaryIndex !== -1) {
    prompts.splice(oldSummaryIndex, 1);
    migrated = true;

    if (storedDefaultId === OLD_DEFAULT_SUMMARY_ID) {
      newDefaultId = SYSTEM_PROMPT_ID;
    }
  }

  return { prompts, migrated, newDefaultId };
}

/**
 * Merges current default prompt definitions into the user's prompt list.
 * Adds missing built-ins and refreshes unmodified built-ins to latest definitions.
 */
export function mergeDefaultPrompts(prompts: Prompt[], effectiveDefaultId: string | undefined): boolean {
  let changed = false;
  const defaultPrompts = createDefaultPrompts(effectiveDefaultId);

  for (const defaultPrompt of defaultPrompts) {
    const existing = prompts.find((p) => p.id === defaultPrompt.id);
    if (!existing) {
      prompts.push(defaultPrompt);
      changed = true;
    } else if (existing.isBuiltIn && !existing.isModified) {
      const def = DEFAULT_PROMPTS.find((d) => d.id === existing.id);
      if (def) {
        existing.name = def.name;
        existing.text = def.text;
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * Ensures the system prompt exists in the list, inserting it at the front if missing.
 */
export function ensureSystemPrompt(prompts: Prompt[], storedDefaultId: string | null): boolean {
  if (prompts.some((p) => p.id === SYSTEM_PROMPT_ID)) {
    return false;
  }

  const systemDef = DEFAULT_PROMPTS.find((d) => d.id === SYSTEM_PROMPT_ID);
  if (systemDef) {
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
    return true;
  }

  return false;
}

/**
 * Fills in the default model for any prompts that are missing one.
 */
export function fillMissingModels(prompts: Prompt[]): boolean {
  let changed = false;
  for (const prompt of prompts) {
    if (!prompt.model) {
      prompt.model = DEFAULT_MODEL_ID;
      changed = true;
    }
  }
  return changed;
}
