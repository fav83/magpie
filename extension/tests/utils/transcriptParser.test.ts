import { describe, it, expect } from 'vitest';
import {
  decodeHtmlEntities,
  parseTranscriptXml,
  parseTranscriptJson,
  parseTranscriptPayload,
} from '../../src/utils/transcriptParser';

describe('transcriptParser', () => {
  describe('decodeHtmlEntities', () => {
    it('should decode basic HTML entities', () => {
      expect(decodeHtmlEntities('&amp;')).toBe('&');
      expect(decodeHtmlEntities('&lt;')).toBe('<');
      expect(decodeHtmlEntities('&gt;')).toBe('>');
      expect(decodeHtmlEntities('&quot;')).toBe('"');
      expect(decodeHtmlEntities('&#39;')).toBe("'");
      expect(decodeHtmlEntities('&apos;')).toBe("'");
      expect(decodeHtmlEntities('&nbsp;')).toBe(' ');
    });

    it('should decode numeric character references', () => {
      expect(decodeHtmlEntities('&#65;')).toBe('A');
      expect(decodeHtmlEntities('&#97;')).toBe('a');
    });

    it('should decode hex character references', () => {
      expect(decodeHtmlEntities('&#x41;')).toBe('A');
      expect(decodeHtmlEntities('&#x61;')).toBe('a');
    });

    it('should handle mixed content', () => {
      expect(decodeHtmlEntities('Hello &amp; World &lt;test&gt;')).toBe(
        'Hello & World <test>'
      );
    });
  });

  describe('parseTranscriptXml', () => {
    it('should return empty string for empty input', () => {
      expect(parseTranscriptXml('')).toBe('');
    });

    it('should parse simple XML transcript with timestamps on separate lines', () => {
      const xml = '<text start="0" dur="1">Hello</text><text start="1" dur="1">World</text>';
      expect(parseTranscriptXml(xml)).toBe('[0:00] Hello\n[0:01] World');
    });

    it('should decode HTML entities in text', () => {
      const xml = '<text start="0" dur="1">Hello &amp; World</text>';
      expect(parseTranscriptXml(xml)).toBe('[0:00] Hello & World');
    });

    it('should trim whitespace in segments', () => {
      const xml = '<text start="0" dur="1">Hello</text><text start="1" dur="1">   World  </text>';
      expect(parseTranscriptXml(xml)).toBe('[0:00] Hello\n[0:01] World');
    });

    it('should skip empty text elements', () => {
      const xml = '<text start="0" dur="1">Hello</text><text start="1" dur="1"></text><text start="2" dur="1">World</text>';
      expect(parseTranscriptXml(xml)).toBe('[0:00] Hello\n[0:02] World');
    });
  });

  describe('parseTranscriptJson', () => {
    it('should return empty string for empty input', () => {
      expect(parseTranscriptJson('')).toBe('');
    });

    it('should parse JSON3 format transcript with timestamps on separate lines', () => {
      const json = JSON.stringify({
        events: [
          { tStartMs: 0, segs: [{ utf8: 'Hello' }] },
          { tStartMs: 1000, segs: [{ utf8: 'World' }] },
        ],
      });
      expect(parseTranscriptJson(json)).toBe('[0:00] Hello\n[0:01] World');
    });

    it('should handle missing segments', () => {
      const json = JSON.stringify({
        events: [{ tStartMs: 0, segs: [{ utf8: 'Hello' }] }, {}],
      });
      expect(parseTranscriptJson(json)).toBe('[0:00] Hello');
    });

    it('should handle missing utf8 property', () => {
      const json = JSON.stringify({
        events: [{ tStartMs: 0, segs: [{ utf8: 'Hello' }, {}] }],
      });
      expect(parseTranscriptJson(json)).toBe('[0:00] Hello');
    });

    it('should trim whitespace in segments', () => {
      const json = JSON.stringify({
        events: [{ tStartMs: 0, segs: [{ utf8: '  Hello World  ' }] }],
      });
      expect(parseTranscriptJson(json)).toBe('[0:00] Hello World');
    });

    it('should return empty string for invalid JSON', () => {
      expect(parseTranscriptJson('not valid json')).toBe('');
    });
  });

  describe('parseTranscriptPayload', () => {
    it('should return empty string for empty input', () => {
      expect(parseTranscriptPayload('')).toBe('');
    });

    it('should parse JSON format first with timestamps', () => {
      const json = JSON.stringify({
        events: [{ tStartMs: 0, segs: [{ utf8: 'JSON Content' }] }],
      });
      expect(parseTranscriptPayload(json)).toBe('[0:00] JSON Content');
    });

    it('should fall back to XML parsing with timestamps', () => {
      const xml = '<text start="0" dur="1">XML Content</text>';
      expect(parseTranscriptPayload(xml)).toBe('[0:00] XML Content');
    });
  });
});
