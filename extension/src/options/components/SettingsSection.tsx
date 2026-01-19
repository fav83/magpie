interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper component for settings sections providing consistent styling.
 * Use for sections that need a title label and consistent vertical spacing.
 */
export function SettingsSection({
  title,
  children,
  className = '',
}: SettingsSectionProps): React.JSX.Element {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {title && (
        <h3 className="text-sm font-medium text-gray-700">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
