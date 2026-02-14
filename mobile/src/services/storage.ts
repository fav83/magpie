import { getPreference, setPreference } from './preferencesHelper';

const STORAGE_KEY = 'openrouter_api_key';

export async function saveApiKey(apiKey: string): Promise<void> {
  await setPreference(STORAGE_KEY, apiKey, 'storage:saveApiKey');
}

export async function loadApiKey(): Promise<string | null> {
  return getPreference(STORAGE_KEY, 'storage:loadApiKey');
}
