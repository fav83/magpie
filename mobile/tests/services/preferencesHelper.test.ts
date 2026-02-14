import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPreference, setPreference } from '../../src/services/preferencesHelper';

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

describe('getPreference', () => {
  it('returns stored value', async () => {
    mockGet.mockResolvedValue({ value: 'stored-value' });

    const result = await getPreference('my_key', 'test:get');

    expect(result).toBe('stored-value');
    expect(mockGet).toHaveBeenCalledWith({ key: 'my_key' });
  });

  it('returns null when nothing stored', async () => {
    mockGet.mockResolvedValue({ value: null });

    const result = await getPreference('my_key', 'test:get');

    expect(result).toBeNull();
  });

  it('returns null when Preferences.get throws', async () => {
    mockGet.mockRejectedValue(new Error('Storage unavailable'));

    const result = await getPreference('my_key', 'test:get');

    expect(result).toBeNull();
  });
});

describe('setPreference', () => {
  it('saves value to Capacitor Preferences', async () => {
    mockSet.mockResolvedValue(undefined);

    await setPreference('my_key', 'my_value', 'test:set');

    expect(mockSet).toHaveBeenCalledWith({
      key: 'my_key',
      value: 'my_value',
    });
  });

  it('does not throw when Preferences.set throws', async () => {
    mockSet.mockRejectedValue(new Error('Storage full'));

    await expect(setPreference('my_key', 'val', 'test:set')).resolves.toBeUndefined();
  });
});
