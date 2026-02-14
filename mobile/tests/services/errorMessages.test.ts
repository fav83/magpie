import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../../src/services/errorMessages';

describe('getErrorMessage', () => {
  it('returns message for known error code', () => {
    expect(getErrorMessage('INVALID_URL')).toBe('Please enter a valid YouTube video URL');
  });

  it('returns message for each known code', () => {
    expect(getErrorMessage('NO_CAPTIONS')).toContain('No transcript');
    expect(getErrorMessage('CONTEXT_TOO_LONG')).toContain('too long');
    expect(getErrorMessage('EXTRACTION_FAILED')).toContain('extract transcript');
    expect(getErrorMessage('API_ERROR')).toContain('generate summary');
    expect(getErrorMessage('NETWORK_ERROR')).toContain('internet');
    expect(getErrorMessage('INVALID_API_KEY')).toContain('generate summary');
    expect(getErrorMessage('RATE_LIMITED')).toContain('Rate limited');
  });

  it('returns default fallback for unknown code', () => {
    expect(getErrorMessage('UNKNOWN_CODE')).toBe('An error occurred.');
  });

  it('returns custom fallback for unknown code', () => {
    expect(getErrorMessage('UNKNOWN_CODE', 'Custom fallback')).toBe('Custom fallback');
  });
});
