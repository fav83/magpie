import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'openrouter_api_key';

export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    await Preferences.set({ key: STORAGE_KEY, value: apiKey });
  } catch {
    // Storage full or unavailable — caller will see key isn't persisted on next load
  }
}

export async function loadApiKey(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    return value;
  } catch {
    return null;
  }
}
