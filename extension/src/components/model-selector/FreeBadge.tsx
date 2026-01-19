export type FreeBadgeSize = 'default' | 'compact';

interface FreeBadgeProps {
  size?: FreeBadgeSize;
}

export function FreeBadge({ size = 'default' }: FreeBadgeProps): React.JSX.Element {
  const sizeClasses = size === 'compact'
    ? 'text-[10px] px-1 py-0.5'
    : 'text-xs px-1.5 py-0.5';

  return (
    <span className={`${sizeClasses} rounded bg-purple-100 text-purple-700 flex-shrink-0`}>
      FREE
    </span>
  );
}
