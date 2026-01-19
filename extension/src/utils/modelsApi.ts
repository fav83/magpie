import type { OpenRouterModel, ModelOption, ModelsCacheStorage } from '../types/models';
import { config, STORAGE_KEYS } from '../config';

// In-memory cache for current session
let sessionModels: ModelOption[] | null = null;

/**
 * Format pricing as "$X.XX / $Y.YY" for display (prices per 1M tokens)
 */
function formatPricing(model: OpenRouterModel): string {
  // Defensive: handle missing or malformed pricing data from API
  const pricing = model.pricing as { prompt?: string; completion?: string } | undefined;
  const promptPrice = parseFloat(pricing?.prompt ?? '0') * 1_000_000;
  const completionPrice = parseFloat(pricing?.completion ?? '0') * 1_000_000;
  // Guard against NaN from invalid values
  const safePrompt = Number.isNaN(promptPrice) ? 0 : promptPrice;
  const safeCompletion = Number.isNaN(completionPrice) ? 0 : completionPrice;
  return `$${safePrompt.toFixed(2)} / $${safeCompletion.toFixed(2)}`;
}

/**
 * Check if a model is free (ID ends with :free AND both prices are 0)
 * Uses numeric comparison to handle various zero formats ('0', '0.0', '0.00', etc.)
 */
function isFreeModel(model: OpenRouterModel): boolean {
  const hasFreeSuffix = model.id.endsWith(':free');
  // Defensive: handle missing pricing (shouldn't happen but test coverage)
  const pricing = model.pricing as { prompt?: string; completion?: string } | undefined;
  if (!pricing) return false;
  const promptPrice = parseFloat(pricing.prompt ?? '');
  const completionPrice = parseFloat(pricing.completion ?? '');
  // Check both prices are exactly 0 (NaN means invalid/missing, so not free)
  const hasZeroPricing = promptPrice === 0 && completionPrice === 0;
  return hasFreeSuffix && hasZeroPricing;
}

/**
 * Convert OpenRouter model to simplified UI option
 */
function toModelOption(model: OpenRouterModel): ModelOption {
  return {
    id: model.id,
    name: model.name,
    contextLength: model.context_length,
    pricingDisplay: formatPricing(model),
    isFree: isFreeModel(model),
  };
}

/**
 * Filter to only text-capable models
 */
function filterTextModels(models: OpenRouterModel[]): OpenRouterModel[] {
  return models.filter(
    (model) =>
      model.architecture.input_modalities.includes('text') &&
      model.architecture.output_modalities.includes('text')
  );
}

/**
 * Get cached models from storage (fallback when API fails)
 */
export async function getCachedModels(): Promise<ModelOption[] | null> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.MODELS_CACHE]);
  const cache = result[STORAGE_KEYS.MODELS_CACHE] as ModelsCacheStorage['modelsCache'] | undefined;
  return cache?.models ?? null;
}

/**
 * Save models to storage cache
 */
async function cacheModels(models: ModelOption[]): Promise<void> {
  const cache: ModelsCacheStorage['modelsCache'] = {
    models,
    timestamp: Date.now(),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.MODELS_CACHE]: cache });
}

/**
 * Fetch models from OpenRouter API
 */
export async function fetchModels(apiKey: string): Promise<ModelOption[]> {
  // Return session cache if available
  if (sessionModels) {
    return sessionModels;
  }

  try {
    const response = await fetch(`${config.openrouter.apiUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = (await response.json()) as { data: OpenRouterModel[] };
    const textModels = filterTextModels(data.data);
    const modelOptions = textModels
      .map(toModelOption)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Cache in memory for session
    sessionModels = modelOptions;

    // Cache in storage for fallback
    await cacheModels(modelOptions);

    return modelOptions;
  } catch (error) {
    // Try fallback cache
    const cached = await getCachedModels();
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Clear session cache (for testing)
 */
export function clearSessionCache(): void {
  sessionModels = null;
}

/**
 * Get context length for a model
 */
export async function getModelContextLength(
  modelId: string,
  apiKey: string
): Promise<number | null> {
  const models = await fetchModels(apiKey);
  const model = models.find((m) => m.id === modelId);
  return model?.contextLength ?? null;
}

/**
 * Check if a model exists in the available models
 */
export async function isValidModel(modelId: string, apiKey: string): Promise<boolean> {
  const models = await fetchModels(apiKey);
  return models.some((m) => m.id === modelId);
}
