export type StarButtonSize = 'default' | 'compact';

interface StarButtonProps {
  isPreferred: boolean;
  onToggle: () => void;
  size?: StarButtonSize;
}

export function StarButton({ isPreferred, onToggle, size = 'default' }: StarButtonProps): React.JSX.Element {
  const sizeClass = size === 'compact' ? 'text-xs' : '';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded transition-colors"
      title={isPreferred ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isPreferred ? (
        <span className={`text-yellow-500 ${sizeClass}`}>★</span>
      ) : (
        <span className={`text-gray-400 hover:text-yellow-500 ${sizeClass}`}>☆</span>
      )}
    </button>
  );
}
