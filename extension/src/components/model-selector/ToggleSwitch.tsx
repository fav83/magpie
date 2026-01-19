export type ToggleSwitchSize = 'default' | 'compact';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  size?: ToggleSwitchSize;
}

export function ToggleSwitch({
  checked,
  onChange,
  size = 'default',
}: ToggleSwitchProps): React.JSX.Element {
  // Size-specific classes
  const trackSize = size === 'compact' ? 'h-4 w-7' : 'h-5 w-9';
  const thumbSize = size === 'compact' ? 'h-3 w-3' : 'h-4 w-4';
  const translateX = size === 'compact' ? 'translate-x-3' : 'translate-x-4';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex ${trackSize} flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block ${thumbSize} transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? translateX : 'translate-x-0'
        }`}
      />
    </button>
  );
}
