import { STORAGE_KEYS } from '../config';
import { createBooleanStorage } from './chromeStorage';

export type FreeFilterLocation = 'options' | 'sidebar';

const optionsStorage = createBooleanStorage(STORAGE_KEYS.SHOW_FREE_ONLY_OPTIONS);
const sidebarStorage = createBooleanStorage(STORAGE_KEYS.SHOW_FREE_ONLY_SIDEBAR);

function getStorage(location: FreeFilterLocation) {
  return location === 'options' ? optionsStorage : sidebarStorage;
}

/**
 * Get the current "show free only" filter state for a location
 */
export async function getShowFreeOnly(location: FreeFilterLocation): Promise<boolean> {
  return getStorage(location).get();
}

/**
 * Set the "show free only" filter state for a location
 */
export async function setShowFreeOnly(
  location: FreeFilterLocation,
  value: boolean
): Promise<void> {
  return getStorage(location).set(value);
}

/**
 * Toggle the "show free only" filter state for a location
 * Returns the new state after toggling
 */
export async function toggleShowFreeOnly(location: FreeFilterLocation): Promise<boolean> {
  return getStorage(location).toggle();
}
