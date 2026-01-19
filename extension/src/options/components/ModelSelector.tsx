import { useModelSelector } from '../../hooks/useModelSelector';
import { ToggleSwitch, ModelList } from '../../components/model-selector';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  apiKey: string | null;
  disabled?: boolean;
}

export function ModelSelector({
  value,
  onChange,
  apiKey,
  disabled = false,
}: ModelSelectorProps): React.JSX.Element {
  const {
    models,
    isLoading,
    isOpen,
    setIsOpen,
    search,
    setSearch,
    error,
    isStale,
    filteredModels,
    selectedModel,
    containerRef,
    inputRef,
    handleSelect,
    handleKeyDown,
    preferredModels,
    nonPreferredModels,
    preferredIds,
    togglePreferred,
    unavailablePreferred,
    showFreeOnly,
    toggleShowFreeOnly,
  } = useModelSelector({ value, onChange, apiKey, trackStaleState: true, filterLocation: 'options' });

  if (error && models.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled || isLoading}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-between"
      >
        <span className="truncate">
          {isLoading ? (
            'Loading models...'
          ) : selectedModel ? (
            <span className="flex items-center gap-2">
              <span>{selectedModel.name}</span>
              <span className="text-xs text-gray-500">{selectedModel.pricingDisplay}</span>
            </span>
          ) : (
            value || 'Select a model'
          )}
        </span>
        <span className="text-gray-400 ml-2">▼</span>
      </button>

      {isStale && (
        <p className="text-xs text-amber-600 mt-1">Model list may be outdated</p>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Free only toggle */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-700">Free only</span>
            <ToggleSwitch
              checked={showFreeOnly}
              onChange={() => { void toggleShowFreeOnly(); }}
            />
          </div>
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="Search models..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="overflow-y-auto max-h-60">
            <ModelList
              models={models}
              filteredModels={filteredModels}
              preferredModels={preferredModels}
              nonPreferredModels={nonPreferredModels}
              unavailablePreferred={unavailablePreferred}
              preferredIds={preferredIds}
              selectedValue={value}
              search={search}
              showFreeOnly={showFreeOnly}
              onSelect={handleSelect}
              onTogglePreferred={(modelId) => { void togglePreferred(modelId); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
