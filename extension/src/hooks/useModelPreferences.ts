import { useState, useEffect, useCallback } from 'react';
import { getPreferredModelIds, togglePreferredModel } from '../utils/preferredModelsStorage';
import { getShowFreeOnly, setShowFreeOnly, type FreeFilterLocation } from '../utils/freeFilterStorage';
import { STORAGE_KEYS } from '../config';

interface UseModelPreferencesOptions {
  filterLocation: FreeFilterLocation;
}

interface UseModelPreferencesReturn {
  preferredIds: Set<string>;
  togglePreferred: (modelId: string) => Promise<void>;
  showFreeOnly: boolean;
  setShowFreeOnly: (value: boolean) => Promise<void>;
  toggleShowFreeOnly: () => Promise<void>;
}

/**
 * Hook for managing model preferences (preferred models and free filter)
 * with automatic storage sync
 */
export function useModelPreferences({
  filterLocation,
}: UseModelPreferencesOptions): UseModelPreferencesReturn {
  const [preferredIds, setPreferredIds] = useState<Set<string>>(new Set());
  const [showFreeOnlyState, setShowFreeOnlyState] = useState(false);

  // Determine storage key for free filter based on location
  const freeFilterStorageKey =
    filterLocation === 'options'
      ? STORAGE_KEYS.SHOW_FREE_ONLY_OPTIONS
      : STORAGE_KEYS.SHOW_FREE_ONLY_SIDEBAR;

  // Load initial state and listen for storage changes
  useEffect(() => {
    void getPreferredModelIds().then((ids) => {
      setPreferredIds(new Set(ids));
    });
    void getShowFreeOnly(filterLocation).then((value) => {
      setShowFreeOnlyState(value);
    });

    // Listen for storage changes to both preferred models and free filter
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange | undefined>) => {
      const preferredChange = changes[STORAGE_KEYS.PREFERRED_MODELS];
      if (preferredChange) {
        const newIds = (preferredChange.newValue as string[] | undefined) ?? [];
        setPreferredIds(new Set(newIds));
      }

      const freeFilterChange = changes[freeFilterStorageKey];
      if (freeFilterChange) {
        setShowFreeOnlyState((freeFilterChange.newValue as boolean | undefined) ?? false);
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, [filterLocation, freeFilterStorageKey]);

  // Toggle preferred status for a model
  const togglePreferred = useCallback(async (modelId: string) => {
    await togglePreferredModel(modelId);
    // State update handled by storage listener
  }, []);

  // Update free filter state
  const handleSetShowFreeOnly = useCallback(
    async (value: boolean) => {
      await setShowFreeOnly(filterLocation, value);
      // State update handled by storage listener
    },
    [filterLocation]
  );

  // Toggle free filter using current state to avoid race conditions
  const handleToggleShowFreeOnly = useCallback(async () => {
    // Use functional update pattern: read current value from storage to avoid stale state
    const currentValue = await getShowFreeOnly(filterLocation);
    await setShowFreeOnly(filterLocation, !currentValue);
  }, [filterLocation]);

  return {
    preferredIds,
    togglePreferred,
    showFreeOnly: showFreeOnlyState,
    setShowFreeOnly: handleSetShowFreeOnly,
    toggleShowFreeOnly: handleToggleShowFreeOnly,
  };
}
