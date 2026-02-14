import { config, openRouterHeaders } from '../config';

export interface ModelPricing {
  /** Cost per 1M input tokens */
  prompt: number;
  /** Cost per 1M output tokens */
  completion: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  pricing: ModelPricing;
}

interface ModelsResponse {
  data: Array<{
    id: string;
    name: string;
    pricing?: { prompt?: string; completion?: string };
  }>;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedModels: ModelInfo[] | null = null;
let cachedForKey: string | null = null;
let cachedAt = 0;

function parsePricing(raw?: { prompt?: string; completion?: string }): ModelPricing {
  const prompt = parseFloat(raw?.prompt ?? '0') * 1_000_000;
  const completion = parseFloat(raw?.completion ?? '0') * 1_000_000;
  return {
    prompt: Number.isNaN(prompt) ? 0 : prompt,
    completion: Number.isNaN(completion) ? 0 : completion,
  };
}

export function isFreeModel(model: ModelInfo): boolean {
  return model.pricing.prompt === 0 && model.pricing.completion === 0;
}

export function formatPricingDisplay(pricing: ModelPricing): string {
  if (pricing.prompt === 0 && pricing.completion === 0) return 'Free';
  return `$${pricing.prompt.toFixed(2)} / $${pricing.completion.toFixed(2)}`;
}

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  if (cachedModels && cachedForKey === apiKey && (Date.now() - cachedAt) < CACHE_TTL_MS) {
    return cachedModels;
  }

  const response = await fetch(`${config.openrouter.apiUrl}/models`, {
    headers: openRouterHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data: ModelsResponse = await response.json();

  const models: ModelInfo[] = data.data
    .map((m) => ({ id: m.id, name: m.name, pricing: parsePricing(m.pricing) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedModels = models;
  cachedForKey = apiKey;
  cachedAt = Date.now();
  return models;
}

export function clearModelCache(): void {
  cachedModels = null;
  cachedForKey = null;
  cachedAt = 0;
}
