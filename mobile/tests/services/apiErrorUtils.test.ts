import { describe, it, expect } from 'vitest';
import { extractErrorDetails } from '../../src/services/apiErrorUtils';

describe('extractErrorDetails', () => {
  describe('nested metadata.raw JSON', () => {
    it('extracts message from metadata.raw when raw is valid JSON', () => {
      const body = JSON.stringify({
        error: {
          message: 'Outer error',
          metadata: { raw: JSON.stringify({ message: 'Inner error from provider' }) },
        },
      });
      expect(extractErrorDetails(body)).toBe('Inner error from provider');
    });

    it('prefers metadata.raw message over top-level message', () => {
      const body = JSON.stringify({
        error: {
          message: 'Generic wrapper',
          metadata: { raw: JSON.stringify({ message: 'Specific provider error' }) },
        },
      });
      expect(extractErrorDetails(body)).toBe('Specific provider error');
    });

    it('returns raw string directly when raw is not valid JSON and short', () => {
      const body = JSON.stringify({
        error: {
          message: 'Outer error',
          metadata: { raw: 'plain text error' },
        },
      });
      expect(extractErrorDetails(body)).toBe('plain text error');
    });

    it('falls back to top-level message when raw is not JSON and too long', () => {
      const longRaw = 'x'.repeat(200);
      const body = JSON.stringify({
        error: {
          message: 'Outer error',
          metadata: { raw: longRaw },
        },
      });
      expect(extractErrorDetails(body)).toBe('Outer error');
    });

    it('falls back to top-level message when metadata.raw JSON has no message field', () => {
      const body = JSON.stringify({
        error: {
          message: 'Outer error',
          metadata: { raw: JSON.stringify({ code: 500 }) },
        },
      });
      expect(extractErrorDetails(body)).toBe('Outer error');
    });
  });

  describe('top-level error.message', () => {
    it('returns top-level error message when no metadata exists', () => {
      const body = JSON.stringify({
        error: { message: 'Bad request' },
      });
      expect(extractErrorDetails(body)).toBe('Bad request');
    });

    it('returns top-level error message when metadata has no raw field', () => {
      const body = JSON.stringify({
        error: { message: 'Something went wrong', metadata: {} },
      });
      expect(extractErrorDetails(body)).toBe('Something went wrong');
    });

    it('returns undefined when error object has no message', () => {
      const body = JSON.stringify({
        error: { code: 400 },
      });
      expect(extractErrorDetails(body)).toBeUndefined();
    });
  });

  describe('non-JSON input', () => {
    it('returns the raw string if it is short enough', () => {
      expect(extractErrorDetails('Something went wrong')).toBe('Something went wrong');
    });

    it('returns undefined for long non-JSON strings', () => {
      const longString = 'a'.repeat(200);
      expect(extractErrorDetails(longString)).toBeUndefined();
    });

    it('returns the raw string for strings just under the 200 char limit', () => {
      const str = 'b'.repeat(199);
      expect(extractErrorDetails(str)).toBe(str);
    });

    it('returns undefined for empty string', () => {
      expect(extractErrorDetails('')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('returns undefined for JSON with no error field', () => {
      const body = JSON.stringify({ success: true });
      expect(extractErrorDetails(body)).toBeUndefined();
    });

    it('handles error being null', () => {
      const body = JSON.stringify({ error: null });
      expect(extractErrorDetails(body)).toBeUndefined();
    });

    it('handles nested raw with empty message', () => {
      const body = JSON.stringify({
        error: {
          message: 'Outer',
          metadata: { raw: JSON.stringify({ message: '' }) },
        },
      });
      // Empty string is falsy, so it falls back to outer message
      expect(extractErrorDetails(body)).toBe('Outer');
    });
  });
});
