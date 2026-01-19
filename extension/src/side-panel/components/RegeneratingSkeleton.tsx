export function RegeneratingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-1.5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-5/6" />
      <div className="h-3 bg-gray-200 rounded w-4/6" />
      <p className="text-xs text-gray-400">Regenerating...</p>
    </div>
  );
}
