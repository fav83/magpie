import { describe, it, expect } from 'vitest';
import {
  setUrlParam,
  extractUrlParam,
  buildUnsignedCaptionUrl,
} from '../../src/utils/urlHelpers';

describe('urlHelpers', () => {
  describe('setUrlParam', () => {
    it('should set a new parameter on a URL', () => {
      const result = setUrlParam('https://example.com', 'key', 'value');
      expect(result).toBe('https://example.com/?key=value');
    });

    it('should update an existing parameter', () => {
      const result = setUrlParam('https://example.com?key=old', 'key', 'new');
      expect(result).toBe('https://example.com/?key=new');
    });

    it('should add parameter to URL with existing params', () => {
      const result = setUrlParam('https://example.com?a=1', 'b', '2');
      expect(result).toBe('https://example.com/?a=1&b=2');
    });

    it('should handle URLs with paths', () => {
      const result = setUrlParam('https://example.com/path', 'key', 'value');
      expect(result).toBe('https://example.com/path?key=value');
    });

    it('should fallback for invalid URLs', () => {
      const result = setUrlParam('not-a-url', 'key', 'value');
      expect(result).toBe('not-a-url?key=value');
    });

    it('should handle fallback with existing query string', () => {
      const result = setUrlParam('not-a-url?a=1', 'b', '2');
      expect(result).toBe('not-a-url?a=1&b=2');
    });
  });

  describe('extractUrlParam', () => {
    it('should extract parameter from URL', () => {
      const result = extractUrlParam('https://example.com?key=value', 'key');
      expect(result).toBe('value');
    });

    it('should return empty string for missing parameter', () => {
      const result = extractUrlParam('https://example.com?other=value', 'key');
      expect(result).toBe('');
    });

    it('should use base URL for relative paths', () => {
      const result = extractUrlParam('/path?key=value', 'key', 'https://example.com');
      expect(result).toBe('value');
    });

    it('should return empty string for invalid URL', () => {
      const result = extractUrlParam(':::invalid:::', 'key');
      expect(result).toBe('');
    });
  });

  describe('buildUnsignedCaptionUrl', () => {
    it('should build URL with video ID and language', () => {
      const result = buildUnsignedCaptionUrl('abc123', 'en');
      expect(result).toContain('v=abc123');
      expect(result).toContain('lang=en');
      expect(result).toContain('fmt=json3');
    });

    it('should include kind parameter when provided', () => {
      const result = buildUnsignedCaptionUrl('abc123', 'en', 'asr');
      expect(result).toContain('kind=asr');
    });

    it('should not include kind parameter when not provided', () => {
      const result = buildUnsignedCaptionUrl('abc123', 'en');
      expect(result).not.toContain('kind=');
    });

    it('should use correct base URL', () => {
      const result = buildUnsignedCaptionUrl('abc123', 'en');
      expect(result).toContain('https://www.youtube.com/api/timedtext');
    });
  });
});
