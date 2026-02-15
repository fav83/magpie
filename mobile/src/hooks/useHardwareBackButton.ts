import { useEffect, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';

type Page = 'main' | 'settings' | 'manage-prompts' | 'manage-favorite-models';

/**
 * Handles the Android hardware back button for page navigation.
 */
export function useHardwareBackButton(
  currentPage: Page,
  setCurrentPage: (updater: (prev: Page) => Page) => void,
  callbacks: {
    reloadFavorites: () => void;
    loadPromptData: () => void;
  },
) {
  const navigateBack = useCallback(() => {
    setCurrentPage((prev) => {
      if (prev === 'manage-favorite-models') {
        callbacks.reloadFavorites();
        return 'settings';
      }
      if (prev === 'manage-prompts') {
        void callbacks.loadPromptData();
        return 'settings';
      }
      if (prev === 'settings') return 'main';
      return prev;
    });
  }, [setCurrentPage, callbacks]);

  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (currentPage === 'main') {
        void CapApp.exitApp();
      } else {
        navigateBack();
      }
    });
    return () => { void listener.then((l) => l.remove()); };
  }, [currentPage, navigateBack]);
}
