import { Preferences } from '@capacitor/preferences';
import DEFAULT_PROMPTS from '../data/defaultPrompts.json';
import { logError } from '../utils/logger';

const STORAGE_KEYS = {
  FAVORITE_MODEL_IDS: 'favorite_model_ids',
  FAVORITE_MODELS_INITIALIZED: 'favorite_models_initialized',
};

export async function getFavoriteModelIds(): Promise<string[]> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.FAVORITE_MODEL_IDS });
    return value ? (JSON.parse(value) as string[]) : [];
  } catch (error) {
    logError('favoriteModelsStorage:getFavoriteModelIds', error);
    return [];
  }
}

export async function saveFavoriteModelIds(ids: string[]): Promise<void> {
  try {
    await Preferences.set({
      key: STORAGE_KEYS.FAVORITE_MODEL_IDS,
      value: JSON.stringify(ids),
    });
  } catch (error) {
    logError('favoriteModelsStorage:saveFavoriteModelIds', error);
  }
}

export async function addFavoriteModel(modelId: string): Promise<void> {
  const ids = await getFavoriteModelIds();
  if (!ids.includes(modelId)) {
    ids.push(modelId);
    await saveFavoriteModelIds(ids);
  }
}

export async function removeFavoriteModel(modelId: string): Promise<void> {
  const ids = await getFavoriteModelIds();
  await saveFavoriteModelIds(ids.filter((id) => id !== modelId));
}

export async function toggleFavoriteModel(modelId: string): Promise<boolean> {
  const ids = await getFavoriteModelIds();
  const index = ids.indexOf(modelId);
  if (index >= 0) {
    ids.splice(index, 1);
    await saveFavoriteModelIds(ids);
    return false;
  } else {
    ids.push(modelId);
    await saveFavoriteModelIds(ids);
    return true;
  }
}

export async function initializeDefaultFavorites(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEYS.FAVORITE_MODELS_INITIALIZED });
    if (value === 'true') return;

    const uniqueModelIds = [...new Set(DEFAULT_PROMPTS.map((p) => p.model))];
    await saveFavoriteModelIds(uniqueModelIds);
    await Preferences.set({ key: STORAGE_KEYS.FAVORITE_MODELS_INITIALIZED, value: 'true' });
  } catch (error) {
    logError('favoriteModelsStorage:initializeDefaultFavorites', error);
  }
}
