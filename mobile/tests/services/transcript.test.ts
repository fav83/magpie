import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatCookies,
  extractApiKey,
  selectTrack,
  decodeEntities,
  parseTranscriptXml,
  fetchTranscript,
  type CaptionTrack,
} from '../../src/services/transcript';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

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

// Helpers for fetchTranscript integration tests
const WATCH_PAGE_HTML = `
<html><head>"INNERTUBE_API_KEY": "AIzaSyTestKey123"</head><body></body></html>
`;

const INNERTUBE_RESPONSE = {
  videoDetails: { title: 'Test Video' },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        { baseUrl: 'https://www.youtube.com/api/timedtext?v=test123&lang=en', languageCode: 'en' },
      ],
    },
  },
};

const CAPTION_XML = '<text start="0" dur="3.0">Hello world</text><text start="5" dur="2.0">Second line</text>';

function mockHeaders(cookies: string[] = []): { get: () => null; getSetCookie: () => string[] } {
  return {
    get: () => null,
    getSetCookie: () => cookies,
  };
}

function setupHappyPath(): void {
  mockFetch.mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.startsWith('https://www.youtube.com/watch')) {
      return { ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() };
    }
    if (typeof url === 'string' && url.startsWith('https://www.youtube.com/youtubei/v1/player')) {
      return { ok: true, json: async () => INNERTUBE_RESPONSE, headers: mockHeaders() };
    }
    if (typeof url === 'string' && url.startsWith('https://www.youtube.com/api/timedtext')) {
      return { ok: true, text: async () => CAPTION_XML, headers: mockHeaders() };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

describe('fetchTranscript', () => {
  it('returns transcript on successful flow', async () => {
    setupHappyPath();

    const result = await fetchTranscript('test123');

    expect(result).toEqual({
      success: true,
      data: {
        transcript: '[0:00] Hello world\n[0:05] Second line',
        title: 'Test Video',
      },
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('returns EXTRACTION_FAILED when no API key in page HTML', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html>no key here</html>',
      headers: mockHeaders(),
    });

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'EXTRACTION_FAILED' });
  });

  it('returns EXTRACTION_FAILED when InnerTube returns non-OK', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'EXTRACTION_FAILED' });
  });

  it('returns EXTRACTION_FAILED when playability status is ERROR', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videoDetails: { title: 'Test' },
          playabilityStatus: { status: 'ERROR' },
          captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: 'http://x', languageCode: 'en' }] } },
        }),
        headers: mockHeaders(),
      });

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'EXTRACTION_FAILED' });
  });

  it('returns NO_CAPTIONS when no caption tracks exist', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ videoDetails: { title: 'Test' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [] } } }),
        headers: mockHeaders(),
      });

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'NO_CAPTIONS' });
  });

  it('returns NO_CAPTIONS when caption XML is empty', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() })
      .mockResolvedValueOnce({ ok: true, json: async () => INNERTUBE_RESPONSE, headers: mockHeaders() })
      .mockResolvedValueOnce({ ok: true, text: async () => '', headers: mockHeaders() });

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'NO_CAPTIONS' });
  });

  it('returns EXTRACTION_FAILED when caption fetch returns non-OK', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() })
      .mockResolvedValueOnce({ ok: true, json: async () => INNERTUBE_RESPONSE, headers: mockHeaders() })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'EXTRACTION_FAILED' });
  });

  it('returns NETWORK_ERROR on fetch TypeError', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'NETWORK_ERROR' });
  });

  it('returns EXTRACTION_FAILED on non-fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('something else'));

    const result = await fetchTranscript('test123');
    expect(result).toEqual({ success: false, error: 'EXTRACTION_FAILED' });
  });

  it('passes signal to all fetch calls', async () => {
    setupHappyPath();
    const controller = new AbortController();

    await fetchTranscript('test123', controller.signal);

    for (const call of mockFetch.mock.calls) {
      const opts = call[1] as RequestInit;
      expect(opts.signal).toBe(controller.signal);
    }
  });

  it('defaults title to Unknown when videoDetails missing', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WATCH_PAGE_HTML, headers: mockHeaders() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?lang=en', languageCode: 'en' }] } },
        }),
        headers: mockHeaders(),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => CAPTION_XML, headers: mockHeaders() });

    const result = await fetchTranscript('test123');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Unknown');
    }
  });
});
