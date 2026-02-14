import { useState, useEffect, useCallback, useRef } from 'react';
import type { ModelInfo } from '../services/modelService';
import { fetchModels, clearModelCache, isFreeModel, formatPricingDisplay } from '../services/modelService';
import { useFavoriteModels } from '../hooks/useFavoriteModels';
import { Spinner, BackButton, inputClass } from './ui';

interface ManageFavoriteModelsProps {
  onBack: () => void;
  apiKey: string | null;
}

export function ManageFavoriteModels({ onBack, apiKey }: ManageFavoriteModelsProps): React.JSX.Element {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const { favoriteIds, toggleFavorite } = useFavoriteModels();
  const listRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(async (modelId: string) => {
    const wasFavorite = favoriteIds.has(modelId);
    await toggleFavorite(modelId);
    // Scroll to top when adding a favorite so the user sees it
    if (!wasFavorite && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [favoriteIds, toggleFavorite]);

  const loadModels = useCallback(async () => {
    if (!apiKey) {
      setError(true);
      setLoading(false);
      return;
    }
    try {
      setError(false);
      setLoading(true);
      const result = await fetchModels(apiKey);
      setModels(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const handleRetry = () => {
    clearModelCache();
    void loadModels();
  };

  const filtered = models?.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase());
    const matchesFree = !freeOnly || isFreeModel(m);
    return matchesSearch && matchesFree;
  }) ?? [];

  const favorites = filtered.filter((m) => favoriteIds.has(m.id));

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 flex items-center">
        <BackButton onClick={onBack} />
        <h1 className="text-lg font-semibold text-gray-800">Favorite Models</h1>
      </header>

      {/* Search + Free filter */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className={`flex-1 min-w-0 placeholder-gray-400 ${inputClass}`}
        />
        <button
          type="button"
          onClick={() => setFreeOnly((v) => !v)}
          className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            freeOnly
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-white border-gray-300 text-gray-500'
          }`}
        >
          Free
        </button>
      </div>

      {/* Content */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6 text-gray-400" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-500">
            <p className="text-red-600 mb-2">
              {apiKey ? 'Failed to load models' : 'API key required to load models'}
            </p>
            {apiKey && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-blue-600 underline text-sm"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && models && (
          <>
            {/* Favorites pinned to top */}
            {favorites.map((m) => (
              <ModelRow
                key={`fav-${m.id}`}
                model={m}
                isFavorite
                onToggle={() => void handleToggle(m.id)}
              />
            ))}
            {favorites.length > 0 && filtered.length > 0 && (
              <div className="border-t border-gray-200 my-2" />
            )}
            {/* All models — favorites show filled star, others hollow */}
            {filtered.map((m) => (
              <ModelRow
                key={m.id}
                model={m}
                isFavorite={favoriteIds.has(m.id)}
                onToggle={() => void handleToggle(m.id)}
              />
            ))}

            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No models match your search</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ModelRow({
  model,
  isFavorite,
  onToggle,
}: {
  model: ModelInfo;
  isFavorite: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between py-2.5 px-1">
      <div className="min-w-0 mr-3">
        <div className="text-sm text-gray-800 truncate">{model.name}</div>
        <div className="text-xs text-gray-400">{formatPricingDisplay(model.pricing)}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="flex-shrink-0 p-1 text-yellow-500"
        aria-label={isFavorite ? `Remove ${model.name} from favorites` : `Add ${model.name} to favorites`}
      >
        {isFavorite ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
