import { describe, it, expect } from 'vitest';
import {
  extractJsonObject,
  extractJsonFromScriptContent,
} from '../../src/utils/jsonExtractor';

describe('jsonExtractor', () => {
  describe('extractJsonObject', () => {
    it('should extract simple JSON object', () => {
      const content = 'var data = {"key": "value"};';
      const result = extractJsonObject(content, content.indexOf('{'));
      expect(result).toBe('{"key": "value"}');
    });

    it('should extract nested JSON object', () => {
      const content = 'var data = {"outer": {"inner": "value"}};';
      const result = extractJsonObject(content, content.indexOf('{'));
      expect(result).toBe('{"outer": {"inner": "value"}}');
    });

    it('should handle strings with braces', () => {
      const content = 'var data = {"key": "value with { braces }"};';
      const result = extractJsonObject(content, content.indexOf('{'));
      expect(result).toBe('{"key": "value with { braces }"}');
    });

    it('should handle escaped quotes in strings', () => {
      const content = 'var data = {"key": "value with \\" quote"};';
      const result = extractJsonObject(content, content.indexOf('{'));
      expect(result).toBe('{"key": "value with \\" quote"}');
    });

    it('should return null for unbalanced braces', () => {
      const content = 'var data = {"key": "value"';
      const result = extractJsonObject(content, content.indexOf('{'));
      expect(result).toBeNull();
    });

    it('should handle arrays inside objects', () => {
      const content = 'var data = {"items": [1, 2, {"nested": true}]};';
      const result = extractJsonObject(content, content.indexOf('{'));
      expect(result).toBe('{"items": [1, 2, {"nested": true}]}');
    });
  });

  describe('extractJsonFromScriptContent', () => {
    it('should extract JSON after marker', () => {
      const content = 'var ytInitialData = {"key": "value"};';
      const result = extractJsonFromScriptContent(content, 'ytInitialData');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null if marker not found', () => {
      const content = 'var otherData = {"key": "value"};';
      const result = extractJsonFromScriptContent(content, 'ytInitialData');
      expect(result).toBeNull();
    });

    it('should return null if no JSON after marker', () => {
      const content = 'var ytInitialData = null;';
      const result = extractJsonFromScriptContent(content, 'ytInitialData');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const content = 'var ytInitialData = {invalid json};';
      const result = extractJsonFromScriptContent(content, 'ytInitialData');
      expect(result).toBeNull();
    });

    it('should handle complex nested JSON', () => {
      const content = `var ytInitialData = {
        "videoDetails": {
          "title": "Test Video",
          "videoId": "abc123"
        }
      };`;
      const result = extractJsonFromScriptContent(content, 'ytInitialData');
      expect(result).toEqual({
        videoDetails: {
          title: 'Test Video',
          videoId: 'abc123',
        },
      });
    });
  });
});
