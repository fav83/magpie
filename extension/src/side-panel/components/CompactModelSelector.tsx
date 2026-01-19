import type { ModelOption } from '../../types/models';
import { useModelSelector } from '../../hooks/useModelSelector';
import { ToggleSwitch, ModelList } from '../../components/model-selector';

interface CompactModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  apiKey: string | null;
  disabled?: boolean;
}

export function CompactModelSelector({
  value,
  onChange,
  apiKey,
  disabled = false,
}: CompactModelSelectorProps): React.JSX.Element {
  const {
    models,
    isLoading,
    isOpen,
    setIsOpen,
    search,
    setSearch,
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
  } = useModelSelector({ value, onChange, apiKey, filterLocation: 'sidebar' });

  // Extract short display name from model
  const getShortName = (model: ModelOption | undefined): string => {
    if (!model) return value ? value.split('/').pop() ?? 'Select' : 'Select';
    // Use model name, but truncate if too long
    const name = model.name;
    if (name.length > 30) {
      return name.substring(0, 28) + '...';
    }
    return name;
  };

  if (!apiKey) {
    return (
      <span className="text-xs text-gray-400 px-2 py-1">
        No API key
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => { if (!disabled && !isLoading) setIsOpen(!isOpen); }}
        disabled={disabled || isLoading}
        className="text-[11px] px-1.5 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 w-full"
        title={selectedModel?.name ?? value}
      >
        <span className="truncate">
          {isLoading ? 'Loading...' : getShortName(selectedModel)}
        </span>
        <span className="text-gray-400 flex-shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="fixed z-50 mt-1 w-[calc(100vw-2rem)] max-w-80 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden" style={{ left: '1rem' }}>
          {/* Free only toggle */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-700">Free only</span>
            <ToggleSwitch
              checked={showFreeOnly}
              onChange={() => { void toggleShowFreeOnly(); }}
              size="compact"
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
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              size="compact"
            />
          </div>
        </div>
      )}
    </div>
  );
}
