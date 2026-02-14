import { config, openRouterHeaders } from '../config';

export interface ModelInfo {
  id: string;
  name: string;
  pricingDisplay: string;
}

interface ModelsResponse {
  data: Array<{
    id: string;
    name: string;
    pricing?: { prompt?: string; completion?: string };
  }>;
}

function formatPricing(pricing?: { prompt?: string; completion?: string }): string {
  const promptPrice = parseFloat(pricing?.prompt ?? '0') * 1_000_000;
  const completionPrice = parseFloat(pricing?.completion ?? '0') * 1_000_000;
  const safePrompt = Number.isNaN(promptPrice) ? 0 : promptPrice;
  const safeCompletion = Number.isNaN(completionPrice) ? 0 : completionPrice;
  if (safePrompt === 0 && safeCompletion === 0) return 'Free';
  return `$${safePrompt.toFixed(2)} / $${safeCompletion.toFixed(2)}`;
}

let cachedModels: ModelInfo[] | null = null;
let cachedForKey: string | null = null;

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  if (cachedModels && cachedForKey === apiKey) {
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
    .map((m) => ({ id: m.id, name: m.name, pricingDisplay: formatPricing(m.pricing) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedModels = models;
  cachedForKey = apiKey;
  return models;
}

export function clearModelCache(): void {
  cachedModels = null;
  cachedForKey = null;
}
