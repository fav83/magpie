import { useState, useCallback, useEffect } from 'react';
import { useChromeStorage } from './useChromeStorage';
import { STORAGE_KEYS } from '../config';
import { validateApiKeyFormat, testApiKey } from '../utils/apiKeyValidation';

export interface UseApiKeyFormOptions {
  /** Whether to sync with stored value on mount (for editing existing keys) */
  syncWithStored?: boolean;
}

export interface UseApiKeyFormReturn {
  /** Current input value */
  apiKey: string;
  /** Set the input value */
  setApiKey: (value: string) => void;
  /** Current error message */
  error: string;
  /** Whether the key has been modified from stored value */
  isModified: boolean;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Whether save was successful (for showing "Saved!" message) */
  isSaved: boolean;
  /** Test result for separate test button */
  testResult: 'success' | 'error' | null;
  /** Whether the last error was a network error (allows save anyway) */
  isNetworkError: boolean;
  /** Validate and save the key (tests API then saves if valid) */
  validateAndSave: () => Promise<boolean>;
  /** Save without testing (format validation only) */
  saveWithoutTest: () => Promise<boolean>;
  /** Test the key without saving */
  testKey: () => Promise<boolean>;
  /** Clear all status states (error, saved, testResult) */
  clearStatus: () => void;
}

/**
 * Shared hook for API key form logic.
 * Supports both "validate and save" (sidebar) and "separate test/save" (options) modes.
 */
export function useApiKeyForm(options: UseApiKeyFormOptions = {}): UseApiKeyFormReturn {
  const { syncWithStored = false } = options;

  const [storedKey, setStoredKey] = useChromeStorage(STORAGE_KEYS.API_KEY, '');
  const [apiKey, setApiKeyState] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const NETWORK_ERROR_MESSAGE = 'Network error. Check your connection.';

  // Sync local state with stored value on first load (if enabled)
  useEffect(() => {
    if (syncWithStored && !initialized && storedKey) {
      setApiKeyState(storedKey);
      setInitialized(true);
    }
  }, [syncWithStored, initialized, storedKey]);

  const isModified = apiKey !== storedKey;

  const clearStatus = useCallback(() => {
    setError('');
    setIsSaved(false);
    setTestResult(null);
    setIsNetworkError(false);
  }, []);

  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value);
    clearStatus();
  }, [clearStatus]);

  // Validate and save (tests API, then saves if valid)
  const validateAndSave = useCallback(async (): Promise<boolean> => {
    clearStatus();

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return false;
    }

    setIsValidating(true);
    const result = await testApiKey(apiKey);
    setIsValidating(false);

    if (result.valid) {
      await setStoredKey(apiKey);
      setIsSaved(true);
      return true;
    } else {
      const errorMsg = result.error ?? 'Invalid API key';
      setError(errorMsg);
      // Track if this was a network error so user can save anyway
      if (errorMsg === NETWORK_ERROR_MESSAGE) {
        setIsNetworkError(true);
      }
      return false;
    }
  }, [apiKey, setStoredKey, clearStatus, NETWORK_ERROR_MESSAGE]);

  // Save without testing (format validation only)
  const saveWithoutTest = useCallback(async (): Promise<boolean> => {
    clearStatus();

    const formatResult = validateApiKeyFormat(apiKey);
    if (!formatResult.valid) {
      setError(formatResult.error ?? 'Invalid key format');
      return false;
    }

    await setStoredKey(apiKey);
    setIsSaved(true);
    return true;
  }, [apiKey, setStoredKey, clearStatus]);

  // Test the key without saving
  const testKey = useCallback(async (): Promise<boolean> => {
    clearStatus();

    setIsValidating(true);
    const result = await testApiKey(apiKey);
    setIsValidating(false);

    if (result.valid) {
      setTestResult('success');
      return true;
    } else {
      setError(result.error ?? 'Invalid API key');
      setTestResult('error');
      return false;
    }
  }, [apiKey, clearStatus]);

  return {
    apiKey,
    setApiKey,
    error,
    isModified,
    isValidating,
    isSaved,
    testResult,
    isNetworkError,
    validateAndSave,
    saveWithoutTest,
    testKey,
    clearStatus,
  };
}
