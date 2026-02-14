import { Preferences } from '@capacitor/preferences';
import { logError } from '../utils/logger';

const STORAGE_KEY = 'font_scale';

export async function saveFontScale(scale: number): Promise<void> {
  try {
    await Preferences.set({ key: STORAGE_KEY, value: String(scale) });
  } catch (error) {
    logError('fontScaleStorage:saveFontScale', error);
  }
}

export async function loadFontScale(): Promise<number> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    return value ? Number(value) : 100;
  } catch (error) {
    logError('fontScaleStorage:loadFontScale', error);
    return 100;
  }
}
