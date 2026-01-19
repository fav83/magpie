import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ModelOption } from '../types/models';
import { fetchModels, getCachedModels } from '../utils/modelsApi';
import type { FreeFilterLocation } from '../utils/freeFilterStorage';
import { useDropdownState } from './useDropdownState';
import { useModelPreferences } from './useModelPreferences';

interface UseModelSelectorOptions {
  value: string;
  onChange: (modelId: string) => void;
  apiKey: string | null;
  trackStaleState?: boolean;
  filterLocation: FreeFilterLocation;
}

interface UseModelSelectorReturn {
  models: ModelOption[];
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  search: string;
  setSearch: (search: string) => void;
  error: string | null;
  isStale: boolean;
  filteredModels: ModelOption[];
  selectedModel: ModelOption | undefined;
  containerRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  handleSelect: (modelId: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  // Preferred models
  preferredModels: ModelOption[];
  nonPreferredModels: ModelOption[];
  preferredIds: Set<string>;
  togglePreferred: (modelId: string) => Promise<void>;
  unavailablePreferred: string[];
  // Free filter
  showFreeOnly: boolean;
  setShowFreeOnly: (value: boolean) => Promise<void>;
  toggleShowFreeOnly: () => Promise<void>;
}

export function useModelSelector({
  value,
  onChange,
  apiKey,
  trackStaleState = false,
  filterLocation,
}: UseModelSelectorOptions): UseModelSelectorReturn {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Clear search callback for when dropdown closes
  const clearSearch = useCallback(() => {
    setSearch('');
  }, []);

  // Use extracted hooks
  const dropdown = useDropdownState({ onClose: clearSearch });
  const {
    preferredIds,
    togglePreferred,
    showFreeOnly,
    setShowFreeOnly,
    toggleShowFreeOnly,
  } = useModelPreferences({ filterLocation });

  // Load models
  useEffect(() => {
    if (!apiKey) {
      // Reset state when API key is cleared
      setModels([]);
      setIsLoading(false);
      setIsStale(false);
      if (trackStaleState) {
        setError('Add your API key to see available models');
      } else {
        setError(null);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    void fetchModels(apiKey)
      .then((fetchedModels) => {
        setModels(fetchedModels);
        setIsStale(false);
      })
      .catch(async () => {
        const cached = await getCachedModels();
        if (cached && cached.length > 0) {
          setModels(cached);
          if (trackStaleState) {
            setIsStale(true);
          }
        } else if (trackStaleState) {
          setError('Could not load models');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiKey, trackStaleState]);

  // Apply free filter to models
  const applyFreeFilter = useCallback(
    (modelList: ModelOption[]) => {
      if (!showFreeOnly) return modelList;
      return modelList.filter((m) => m.isFree);
    },
    [showFreeOnly]
  );

  const filteredModels = useMemo(() => {
    let result = models;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (m) => m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower)
      );
    }
    return applyFreeFilter(result);
  }, [models, search, applyFreeFilter]);

  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === value);
  }, [models, value]);

  const handleSelect = useCallback(
    (modelId: string) => {
      onChange(modelId);
      dropdown.setIsOpen(false);
    },
    [onChange, dropdown]
  );

  // Separate preferred and non-preferred models (both sorted alphabetically, with free filter applied)
  const preferredModels = useMemo(() => {
    const preferred = models
      .filter((m) => preferredIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return applyFreeFilter(preferred);
  }, [models, preferredIds, applyFreeFilter]);

  const nonPreferredModels = useMemo(() => {
    const nonPreferred = models
      .filter((m) => !preferredIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return applyFreeFilter(nonPreferred);
  }, [models, preferredIds, applyFreeFilter]);

  // Models in display order: preferred first, then non-preferred (both alphabetically sorted)
  const displayedModels = useMemo(() => {
    return [...preferredModels, ...nonPreferredModels];
  }, [preferredModels, nonPreferredModels]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        dropdown.setIsOpen(false);
      } else if (e.key === 'Enter') {
        // When searching, use filtered results; otherwise use display order
        const targetList = search ? filteredModels : displayedModels;
        const first = targetList[0];
        if (first) {
          handleSelect(first.id);
        }
      }
    },
    [filteredModels, displayedModels, search, handleSelect, dropdown]
  );

  // Find preferred model IDs that are not in current models list
  // Hide unavailable preferred when free filter is active (can't verify they're free)
  const unavailablePreferred = useMemo(() => {
    if (showFreeOnly) return [];
    const modelIdSet = new Set(models.map((m) => m.id));
    return Array.from(preferredIds).filter((id) => !modelIdSet.has(id));
  }, [models, preferredIds, showFreeOnly]);

  return {
    models,
    isLoading,
    isOpen: dropdown.isOpen,
    setIsOpen: dropdown.setIsOpen,
    search,
    setSearch,
    error,
    isStale,
    filteredModels,
    selectedModel,
    containerRef: dropdown.containerRef,
    inputRef: dropdown.inputRef,
    handleSelect,
    handleKeyDown,
    preferredModels,
    nonPreferredModels,
    preferredIds,
    togglePreferred,
    unavailablePreferred,
    showFreeOnly,
    setShowFreeOnly,
    toggleShowFreeOnly,
  };
}
