import { Preferences } from '@capacitor/preferences';
import { logError } from '../utils/logger';

export async function getPreference(key: string, context: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch (error) {
    logError(context, error);
    return null;
  }
}

export async function setPreference(key: string, value: string, context: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch (error) {
    logError(context, error);
  }
}
