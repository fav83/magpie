import { useChromeStorage } from '../../hooks/useChromeStorage';
import { FONT_SIZE, STORAGE_KEYS } from '../../config';
import { SettingsSection } from './SettingsSection';

// Legacy string values from old dropdown (map to pixel values)
const LEGACY_FONT_SIZE_MAP: Record<string, number> = {
  small: 10,
  medium: 12,
  large: 14,
};

/**
 * Normalizes font size value for display, handling legacy string values.
 */
function normalizeFontSize(value: number | string): number {
  if (typeof value === 'string') {
    const mapped = LEGACY_FONT_SIZE_MAP[value];
    if (mapped !== undefined) return mapped;
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) return Math.max(FONT_SIZE.MIN, Math.min(FONT_SIZE.MAX, parsed));
    return FONT_SIZE.DEFAULT;
  }
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(FONT_SIZE.MIN, Math.min(FONT_SIZE.MAX, value));
  }
  return FONT_SIZE.DEFAULT;
}

export function DisplaySettings(): React.JSX.Element {
  const [storedFontSize, setFontSize] = useChromeStorage<number | string>(
    STORAGE_KEYS.FONT_SIZE,
    FONT_SIZE.DEFAULT
  );

  // Normalize for display (handles legacy string values)
  const fontSize = normalizeFontSize(storedFontSize);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Always save as number to migrate legacy values
    void setFontSize(Number(e.target.value));
  };

  return (
    <SettingsSection title="Display Settings">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Summary Font Size</span>
          <span className="text-sm font-medium text-gray-700">{fontSize}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-4">{FONT_SIZE.MIN}</span>
          <input
            type="range"
            min={FONT_SIZE.MIN}
            max={FONT_SIZE.MAX}
            value={fontSize}
            onChange={handleChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-xs text-gray-400 w-4">{FONT_SIZE.MAX}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Controls the font size of summary text in the sidebar.
        </p>
      </div>
    </SettingsSection>
  );
}
