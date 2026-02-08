import { config, openRouterHeaders } from '../config';

export interface ModelInfo {
  id: string;
  name: string;
}

let cachedModels: ModelInfo[] | null = null;

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  if (cachedModels) {
    return cachedModels;
  }

  const response = await fetch(`${config.openrouter.apiUrl}/models`, {
    headers: openRouterHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ id: string; name: string }> };

  const models: ModelInfo[] = data.data
    .map((m) => ({ id: m.id, name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedModels = models;
  return models;
}

export function clearModelCache(): void {
  cachedModels = null;
}
