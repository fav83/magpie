import { useState, useEffect, useCallback } from 'react';
import {
  getFavoriteModelIds,
  initializeDefaultFavorites,
  toggleFavoriteModel,
} from '../services/favoriteModelsStorage';

export function useFavoriteModels() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const loadFavorites = useCallback(async () => {
    await initializeDefaultFavorites();
    const ids = await getFavoriteModelIds();
    setFavoriteIds(new Set(ids));
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const toggleFavorite = useCallback(async (modelId: string) => {
    const isNowFavorite = await toggleFavoriteModel(modelId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isNowFavorite) {
        next.add(modelId);
      } else {
        next.delete(modelId);
      }
      return next;
    });
  }, []);

  const reloadFavorites = useCallback(() => {
    void loadFavorites();
  }, [loadFavorites]);

  return { favoriteIds, toggleFavorite, reloadFavorites };
}
