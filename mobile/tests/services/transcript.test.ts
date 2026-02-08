import { describe, it, expect } from 'vitest';
import {
  formatCookies,
  extractApiKey,
  selectTrack,
  decodeEntities,
  parseTranscriptXml,
  type CaptionTrack,
} from '../../src/services/transcript';

describe('formatCookies', () => {
  it('formats a single cookie', () => {
    expect(formatCookies({ CONSENT: 'YES+123' })).toBe('CONSENT=YES+123');
  });

  it('formats multiple cookies joined by semicolon', () => {
    const result = formatCookies({ a: '1', b: '2' });
    expect(result).toBe('a=1; b=2');
  });

  it('returns empty string for empty object', () => {
    expect(formatCookies({})).toBe('');
  });
});

describe('extractApiKey', () => {
  it('extracts API key from typical page HTML', () => {
    const html = 'some stuff "INNERTUBE_API_KEY": "AIzaSyB-abc123_def" more stuff';
    expect(extractApiKey(html)).toBe('AIzaSyB-abc123_def');
  });

  it('returns null when key is not present', () => {
    expect(extractApiKey('<html><body>no key here</body></html>')).toBeNull();
  });

  it('handles key with hyphens and underscores', () => {
    const html = '"INNERTUBE_API_KEY":"a-b_c-D"';
    expect(extractApiKey(html)).toBe('a-b_c-D');
  });
});

describe('selectTrack', () => {
  const enManual: CaptionTrack = { baseUrl: 'http://en-manual', languageCode: 'en' };
  const enAsr: CaptionTrack = { baseUrl: 'http://en-asr', languageCode: 'en', kind: 'asr' };
  const frManual: CaptionTrack = { baseUrl: 'http://fr-manual', languageCode: 'fr' };

  it('prefers English manual over English ASR', () => {
    expect(selectTrack([enAsr, enManual, frManual])).toBe(enManual);
  });

  it('prefers English ASR when no English manual exists', () => {
    expect(selectTrack([frManual, enAsr])).toBe(enAsr);
  });

  it('falls back to first track when no English tracks exist', () => {
    expect(selectTrack([frManual])).toBe(frManual);
  });

  it('returns undefined for empty array', () => {
    expect(selectTrack([])).toBeUndefined();
  });

  it('returns English manual even if it appears after ASR', () => {
    expect(selectTrack([enAsr, frManual, enManual])).toBe(enManual);
  });
});

describe('decodeEntities', () => {
  it('decodes &amp;', () => {
    expect(decodeEntities('rock &amp; roll')).toBe('rock & roll');
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeEntities('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
  });

  it('decodes &#39; (apostrophe)', () => {
    expect(decodeEntities('it&#39;s')).toBe("it's");
  });

  it('decodes &quot;', () => {
    expect(decodeEntities('&quot;hello&quot;')).toBe('"hello"');
  });

  it('decodes double-encoded &amp;#39;', () => {
    expect(decodeEntities('it&amp;#39;s')).toBe("it's");
  });

  it('passes through text without entities', () => {
    expect(decodeEntities('hello world')).toBe('hello world');
  });
});

describe('parseTranscriptXml', () => {
  it('parses a single caption line', () => {
    const xml = '<text start="0" dur="5.0">Hello world</text>';
    expect(parseTranscriptXml(xml)).toEqual(['[0:00] Hello world']);
  });

  it('parses multiple lines with timestamps', () => {
    const xml =
      '<text start="0" dur="3.0">First</text>' +
      '<text start="65.5" dur="2.0">Second</text>';
    const result = parseTranscriptXml(xml);
    expect(result).toEqual(['[0:00] First', '[1:05] Second']);
  });

  it('strips HTML tags from caption text', () => {
    const xml = '<text start="0" dur="1.0"><b>bold</b> text</text>';
    expect(parseTranscriptXml(xml)).toEqual(['[0:00] bold text']);
  });

  it('decodes HTML entities in caption text', () => {
    const xml = '<text start="0" dur="1.0">rock &amp; roll</text>';
    expect(parseTranscriptXml(xml)).toEqual(['[0:00] rock & roll']);
  });

  it('skips empty text elements', () => {
    const xml =
      '<text start="0" dur="1.0">Hello</text>' +
      '<text start="5" dur="1.0">   </text>' +
      '<text start="10" dur="1.0">World</text>';
    expect(parseTranscriptXml(xml)).toEqual(['[0:00] Hello', '[0:10] World']);
  });

  it('returns empty array for empty XML', () => {
    expect(parseTranscriptXml('')).toEqual([]);
  });

  it('formats minutes and seconds correctly', () => {
    const xml = '<text start="3661" dur="1.0">Over an hour</text>';
    const result = parseTranscriptXml(xml);
    expect(result).toEqual(['[61:01] Over an hour']);
  });

  it('pads seconds to two digits', () => {
    const xml = '<text start="5" dur="1.0">Five seconds</text>';
    expect(parseTranscriptXml(xml)).toEqual(['[0:05] Five seconds']);
  });
});
