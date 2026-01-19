import { describe, it, expect } from 'vitest';
import { formatSummaryForClipboard } from '../../src/utils/clipboard';

describe('formatSummaryForClipboard', () => {
  const sampleContent = 'This is the summary content.';
  const sampleTitle = 'Test Video Title';
  const sampleUrl = 'https://youtube.com/watch?v=abc123';

  describe('without metadata', () => {
    it('should return content only when no title or URL provided', () => {
      const result = formatSummaryForClipboard(sampleContent);
      expect(result).toBe(sampleContent);
    });

    it('should return content only when title is undefined and URL is undefined', () => {
      const result = formatSummaryForClipboard(sampleContent, undefined, undefined);
      expect(result).toBe(sampleContent);
    });

    it('should return content only when title is empty and URL is empty', () => {
      const result = formatSummaryForClipboard(sampleContent, '', '');
      expect(result).toBe(sampleContent);
    });
  });

  describe('with title only', () => {
    it('should include title in header', () => {
      const result = formatSummaryForClipboard(sampleContent, sampleTitle);
      expect(result).toBe(`${sampleTitle}\n\n${sampleContent}`);
    });

    it('should include title when URL is empty', () => {
      const result = formatSummaryForClipboard(sampleContent, sampleTitle, '');
      expect(result).toBe(`${sampleTitle}\n\n${sampleContent}`);
    });
  });

  describe('with URL only', () => {
    it('should include URL in header', () => {
      const result = formatSummaryForClipboard(sampleContent, undefined, sampleUrl);
      expect(result).toBe(`${sampleUrl}\n\n${sampleContent}`);
    });

    it('should include URL when title is empty', () => {
      const result = formatSummaryForClipboard(sampleContent, '', sampleUrl);
      expect(result).toBe(`${sampleUrl}\n\n${sampleContent}`);
    });
  });

  describe('with title and URL', () => {
    it('should include both title and URL in header', () => {
      const result = formatSummaryForClipboard(sampleContent, sampleTitle, sampleUrl);
      expect(result).toBe(`${sampleTitle}\n${sampleUrl}\n\n${sampleContent}`);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = formatSummaryForClipboard('', sampleTitle, sampleUrl);
      expect(result).toBe(`${sampleTitle}\n${sampleUrl}\n\n`);
    });

    it('should handle multiline content', () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      const result = formatSummaryForClipboard(multilineContent, sampleTitle);
      expect(result).toBe(`${sampleTitle}\n\n${multilineContent}`);
    });

    it('should handle special characters in title', () => {
      const specialTitle = 'Video: "Test" & <Analysis>';
      const result = formatSummaryForClipboard(sampleContent, specialTitle);
      expect(result).toBe(`${specialTitle}\n\n${sampleContent}`);
    });
  });
});
