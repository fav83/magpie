import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveApiKey, loadApiKey } from '../../src/services/storage';

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

describe('saveApiKey', () => {
  it('saves key to Capacitor Preferences', async () => {
    mockSet.mockResolvedValue(undefined);

    await saveApiKey('sk-or-test-key');

    expect(mockSet).toHaveBeenCalledWith({
      key: 'openrouter_api_key',
      value: 'sk-or-test-key',
    });
  });
});

describe('loadApiKey', () => {
  it('returns key when stored', async () => {
    mockGet.mockResolvedValue({ value: 'sk-or-stored-key' });

    const result = await loadApiKey();

    expect(result).toBe('sk-or-stored-key');
    expect(mockGet).toHaveBeenCalledWith({ key: 'openrouter_api_key' });
  });

  it('returns null when no key stored', async () => {
    mockGet.mockResolvedValue({ value: null });

    const result = await loadApiKey();

    expect(result).toBeNull();
  });

  it('returns null when Preferences.get throws', async () => {
    mockGet.mockRejectedValue(new Error('Storage unavailable'));

    const result = await loadApiKey();

    expect(result).toBeNull();
  });
});

describe('saveApiKey - error handling', () => {
  it('does not throw when Preferences.set throws', async () => {
    mockSet.mockRejectedValue(new Error('Storage full'));

    await expect(saveApiKey('sk-or-test-key')).resolves.toBeUndefined();
  });
});
