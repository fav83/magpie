// OpenRouter model from API response
export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
  };
}

// Simplified model for UI display
export interface ModelOption {
  id: string;
  name: string;
  contextLength: number;
  pricingDisplay: string;
  isFree: boolean;
}

// API response structure
export interface ModelsApiResponse {
  data: OpenRouterModel[];
}

// Storage for cached models
export interface ModelsCacheStorage {
  modelsCache?: {
    models: ModelOption[];
    timestamp: number;
  };
}

export const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini';
