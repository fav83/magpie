import { getPreference, setPreference } from './preferencesHelper';

const STORAGE_KEY = 'font_scale';

export async function saveFontScale(scale: number): Promise<void> {
  await setPreference(STORAGE_KEY, String(scale), 'fontScaleStorage:saveFontScale');
}

export async function loadFontScale(): Promise<number> {
  const value = await getPreference(STORAGE_KEY, 'fontScaleStorage:loadFontScale');
  return value ? Number(value) : 100;
}
