import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to read and write a single value from Chrome storage with automatic sync
 */
export function useChromeStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial value
  useEffect(() => {
    void chrome.storage.local.get([key]).then((result) => {
      if (key in result) {
        setValue(result[key] as T);
      }
      setIsLoading(false);
    });
  }, [key]);

  // Listen for changes
  useEffect(() => {
    const handleChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[key]) {
        setValue(changes[key].newValue as T);
      }
    };

    chrome.storage.local.onChanged.addListener(handleChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleChange);
    };
  }, [key]);

  // Setter function
  const setStorageValue = useCallback(
    async (newValue: T) => {
      await chrome.storage.local.set({ [key]: newValue });
      setValue(newValue);
    },
    [key]
  );

  return [value, setStorageValue, isLoading];
}

/**
 * Hook to subscribe to Chrome storage changes for specific keys
 */
export function useStorageListener(
  keys: string[],
  callback: () => void
): void {
  useEffect(() => {
    const handleChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (keys.some((key) => key in changes)) {
        callback();
      }
    };

    chrome.storage.local.onChanged.addListener(handleChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleChange);
    };
  }, [keys, callback]);
}
