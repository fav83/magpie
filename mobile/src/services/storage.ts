import { Preferences } from '@capacitor/preferences';
import { logError } from '../utils/logger';

const STORAGE_KEY = 'openrouter_api_key';

export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    await Preferences.set({ key: STORAGE_KEY, value: apiKey });
  } catch (error) {
    logError('storage:saveApiKey', error);
  }
}

export async function loadApiKey(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    return value;
  } catch (error) {
    logError('storage:loadApiKey', error);
    return null;
  }
}
