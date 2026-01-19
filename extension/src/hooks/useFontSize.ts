import { useChromeStorage } from './useChromeStorage';
import { FONT_SIZE, STORAGE_KEYS } from '../config';

// Legacy string values from old dropdown (map to pixel values)
const LEGACY_FONT_SIZE_MAP: Record<string, number> = {
  small: 10,
  medium: 12,
  large: 14,
};

/**
 * Normalizes font size value, handling legacy string values.
 * Returns a valid pixel number within bounds.
 */
function normalizeFontSize(value: unknown): number {
  // Handle legacy string values
  if (typeof value === 'string') {
    const mapped = LEGACY_FONT_SIZE_MAP[value];
    if (mapped !== undefined) {
      return mapped;
    }
    // Try parsing as number string
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return Math.max(FONT_SIZE.MIN, Math.min(FONT_SIZE.MAX, parsed));
    }
    return FONT_SIZE.DEFAULT;
  }

  // Handle numeric values
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(FONT_SIZE.MIN, Math.min(FONT_SIZE.MAX, value));
  }

  return FONT_SIZE.DEFAULT;
}

/**
 * Formats a font size number to a CSS px string.
 * Use this when you need a string value (e.g., for data attributes in tests).
 * Note: React's style prop accepts numbers directly and adds 'px' automatically.
 */
export function formatFontSize(size: number): string {
  return `${size}px`;
}

/**
 * Hook to get the user's preferred font size setting.
 * Returns the font size as a number (pixels).
 *
 * Usage in React style prop (automatic px conversion):
 *   <div style={{ fontSize }}>...</div>
 *
 * Handles migration from legacy string values ('small', 'medium', 'large').
 */
export function useFontSize(): number {
  const [fontSize] = useChromeStorage<number | string>(STORAGE_KEYS.FONT_SIZE, FONT_SIZE.DEFAULT);
  return normalizeFontSize(fontSize);
}
