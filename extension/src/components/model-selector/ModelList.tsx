import type { ModelOption } from '../../types/models';
import { ModelRow, type ModelRowSize } from './ModelRow';
import { UnavailableModelRow } from './UnavailableModelRow';

export type ModelListSize = 'default' | 'compact';

interface ModelListProps {
  models: ModelOption[];
  filteredModels: ModelOption[];
  preferredModels: ModelOption[];
  nonPreferredModels: ModelOption[];
  unavailablePreferred: string[];
  preferredIds: Set<string>;
  selectedValue: string;
  search: string;
  showFreeOnly: boolean;
  onSelect: (modelId: string) => void;
  onTogglePreferred: (modelId: string) => void;
  size?: ModelListSize;
}

export function ModelList({
  models,
  filteredModels,
  preferredModels,
  nonPreferredModels,
  unavailablePreferred,
  preferredIds,
  selectedValue,
  search,
  showFreeOnly,
  onSelect,
  onTogglePreferred,
  size = 'default',
}: ModelListProps): React.JSX.Element {
  const textSize = size === 'compact' ? 'text-xs' : 'text-sm';
  const hasPreferredSection = preferredModels.length > 0 || unavailablePreferred.length > 0;

  // When searching, show flat results
  if (search) {
    if (filteredModels.length === 0) {
      const message = showFreeOnly
        ? 'No free models match your search'
        : 'No models found';
      return <div className={`px-3 py-4 ${textSize} text-gray-500 text-center`}>{message}</div>;
    }
    return (
      <>
        {filteredModels.map((model) => (
          <ModelRow
            key={model.id}
            model={model}
            isSelected={model.id === selectedValue}
            isPreferred={preferredIds.has(model.id)}
            onSelect={() => { onSelect(model.id); }}
            onTogglePreferred={() => { onTogglePreferred(model.id); }}
            size={size as ModelRowSize}
          />
        ))}
      </>
    );
  }

  // Check if all models are filtered out
  const noModelsToShow = preferredModels.length === 0 && nonPreferredModels.length === 0 && unavailablePreferred.length === 0;
  if (noModelsToShow && models.length > 0 && showFreeOnly) {
    return <div className={`px-3 py-4 ${textSize} text-gray-500 text-center`}>No free models available</div>;
  }

  // When not searching, show preferred section first
  return (
    <>
      {/* Preferred models section */}
      {preferredModels.map((model) => (
        <ModelRow
          key={model.id}
          model={model}
          isSelected={model.id === selectedValue}
          isPreferred={true}
          onSelect={() => { onSelect(model.id); }}
          onTogglePreferred={() => { onTogglePreferred(model.id); }}
          size={size as ModelRowSize}
        />
      ))}

      {/* Unavailable preferred models */}
      {unavailablePreferred.map((modelId) => (
        <UnavailableModelRow
          key={modelId}
          modelId={modelId}
          onTogglePreferred={() => { onTogglePreferred(modelId); }}
          size={size as ModelRowSize}
        />
      ))}

      {/* Divider */}
      {hasPreferredSection && nonPreferredModels.length > 0 && (
        <div className="border-t border-gray-200 my-1" />
      )}

      {/* Non-preferred models */}
      {nonPreferredModels.map((model) => (
        <ModelRow
          key={model.id}
          model={model}
          isSelected={model.id === selectedValue}
          isPreferred={false}
          onSelect={() => { onSelect(model.id); }}
          onTogglePreferred={() => { onTogglePreferred(model.id); }}
          size={size as ModelRowSize}
        />
      ))}

      {/* Empty state */}
      {models.length === 0 && (
        <div className={`px-3 py-2 ${textSize} text-gray-500`}>No models available</div>
      )}
    </>
  );
}
