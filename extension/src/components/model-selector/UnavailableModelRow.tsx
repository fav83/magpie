import { StarButton, type StarButtonSize } from './StarButton';

export type UnavailableModelRowSize = 'default' | 'compact';

interface UnavailableModelRowProps {
  modelId: string;
  onTogglePreferred: () => void;
  size?: UnavailableModelRowSize;
}

export function UnavailableModelRow({
  modelId,
  onTogglePreferred,
  size = 'default',
}: UnavailableModelRowProps): React.JSX.Element {
  // Extract display name from model ID (e.g., "openai/gpt-4o" -> "gpt-4o")
  const displayName = modelId.split('/').pop() ?? modelId;
  const gapClass = size === 'compact' ? 'gap-1.5' : 'gap-2';
  const pricingClass = size === 'compact' ? 'text-[10px]' : 'text-xs';

  return (
    <div
      className={`w-full px-3 py-1.5 text-left text-xs flex items-center ${gapClass} text-gray-400 cursor-not-allowed`}
      title="This model is no longer available"
    >
      <StarButton
        isPreferred={true}
        onToggle={onTogglePreferred}
        size={size as StarButtonSize}
      />
      <span className="truncate font-medium italic">{displayName}</span>
      <span className={`${pricingClass} ml-auto whitespace-nowrap`}>(unavailable)</span>
    </div>
  );
}
