import type { ModelOption } from '../../types/models';
import { StarButton, type StarButtonSize } from './StarButton';
import { FreeBadge, type FreeBadgeSize } from './FreeBadge';

export type ModelRowSize = 'default' | 'compact';

interface ModelRowProps {
  model: ModelOption;
  isSelected: boolean;
  isPreferred: boolean;
  onSelect: () => void;
  onTogglePreferred: () => void;
  isUnavailable?: boolean;
  size?: ModelRowSize;
}

export function ModelRow({
  model,
  isSelected,
  isPreferred,
  onSelect,
  onTogglePreferred,
  isUnavailable = false,
  size = 'default',
}: ModelRowProps): React.JSX.Element {
  const gapClass = size === 'compact' ? 'gap-1.5' : 'gap-2';
  const pricingClass = size === 'compact' ? 'text-[10px]' : 'text-xs';

  return (
    <div
      className={`w-full px-3 py-1.5 text-left text-xs flex items-center ${gapClass} ${
        isUnavailable
          ? 'text-gray-400 cursor-not-allowed'
          : `hover:bg-blue-50 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`
      }`}
      onClick={isUnavailable ? undefined : onSelect}
      role="button"
      tabIndex={isUnavailable ? -1 : 0}
      onKeyDown={(e) => {
        if (!isUnavailable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <StarButton
        isPreferred={isPreferred}
        onToggle={onTogglePreferred}
        size={size as StarButtonSize}
      />
      <span className={`truncate font-medium ${isUnavailable ? 'italic' : 'text-gray-900'}`}>
        {model.name}
      </span>
      {model.isFree && <FreeBadge size={size as FreeBadgeSize} />}
      <span className={`${pricingClass} text-gray-500 ml-auto whitespace-nowrap ${size === 'compact' ? 'flex-shrink-0' : ''}`}>
        {isUnavailable ? '(unavailable)' : model.pricingDisplay}
      </span>
    </div>
  );
}
