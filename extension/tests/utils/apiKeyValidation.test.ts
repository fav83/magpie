import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupChromeMock, resetChromeMock } from '../mocks/chrome';

// Stub fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Now import the module that uses fetch
import { validateApiKeyFormat, testApiKey } from '../../src/utils/apiKeyValidation';

setupChromeMock();

describe('apiKeyValidation', () => {
  describe('validateApiKeyFormat', () => {
    it('should return valid for correct format', () => {
      const result = validateApiKeyFormat('sk-or-v1-abc123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for key not starting with sk-or-', () => {
      const result = validateApiKeyFormat('invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format. Should start with sk-or-');
    });

    it('should return invalid for empty string', () => {
      const result = validateApiKeyFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format. Should start with sk-or-');
    });

    it('should return invalid for key starting with sk- but not sk-or-', () => {
      const result = validateApiKeyFormat('sk-abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format. Should start with sk-or-');
    });

    it('should return valid for key that exactly starts with sk-or-', () => {
      const result = validateApiKeyFormat('sk-or-');
      expect(result.valid).toBe(true);
    });
  });

  describe('testApiKey', () => {
    beforeEach(() => {
      resetChromeMock();
      mockFetch.mockReset();
    });

    it('should return format error for invalid format', async () => {
      const result = await testApiKey('invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format. Should start with sk-or-');
    });

    it('should return valid for successful API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await testApiKey('sk-or-v1-valid-key');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for 401 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await testApiKey('sk-or-v1-invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should return invalid for 403 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await testApiKey('sk-or-v1-forbidden-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should return API error for other status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await testApiKey('sk-or-v1-error-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API error: 500');
    });

    it('should return network error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await testApiKey('sk-or-v1-valid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error. Check your connection.');
    });

    it('should call correct API endpoint with headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      await testApiKey('sk-or-v1-test-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/key'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer sk-or-v1-test-key',
            'HTTP-Referer': expect.stringContaining('chrome-extension://'),
            'X-Title': 'Magpie',
          },
        })
      );
    });
  });
});
