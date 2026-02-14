import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveFontScale, loadFontScale } from '../../src/services/fontScaleStorage';

const mockSet = vi.fn();
const mockGet = vi.fn();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: (...args: unknown[]) => mockSet(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

beforeEach(() => {
  mockSet.mockReset();
  mockGet.mockReset();
});

describe('saveFontScale', () => {
  it('saves scale to Capacitor Preferences', async () => {
    mockSet.mockResolvedValue(undefined);

    await saveFontScale(120);

    expect(mockSet).toHaveBeenCalledWith({
      key: 'font_scale',
      value: '120',
    });
  });

  it('does not throw when Preferences.set throws', async () => {
    mockSet.mockRejectedValue(new Error('Storage full'));

    await expect(saveFontScale(120)).resolves.toBeUndefined();
  });
});

describe('loadFontScale', () => {
  it('returns stored value', async () => {
    mockGet.mockResolvedValue({ value: '150' });

    const result = await loadFontScale();

    expect(result).toBe(150);
    expect(mockGet).toHaveBeenCalledWith({ key: 'font_scale' });
  });

  it('returns 100 when nothing stored', async () => {
    mockGet.mockResolvedValue({ value: null });

    const result = await loadFontScale();

    expect(result).toBe(100);
  });

  it('returns 100 when Preferences.get throws', async () => {
    mockGet.mockRejectedValue(new Error('Storage unavailable'));

    const result = await loadFontScale();

    expect(result).toBe(100);
  });
});
