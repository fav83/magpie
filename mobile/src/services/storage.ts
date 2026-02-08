import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'openrouter_api_key';

export async function saveApiKey(apiKey: string): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: apiKey });
}

export async function loadApiKey(): Promise<string | null> {
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  return value;
}
