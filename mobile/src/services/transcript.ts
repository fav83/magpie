import type { Result } from '../types/result';

export interface TranscriptResult {
  transcript: string;
  title: string;
}

export type TranscriptError = 'NO_CAPTIONS' | 'EXTRACTION_FAILED' | 'NETWORK_ERROR';

const WATCH_URL = 'https://www.youtube.com/watch?v=';
const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?key=';
const INNERTUBE_CONTEXT = { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } };

export function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { runs?: Array<{ text: string }> };
}

interface InnerTubeResponse {
  videoDetails?: { title?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
  playabilityStatus?: { status?: string };
}

/**
 * Fetches the YouTube watch page HTML, handling the GDPR consent flow.
 * Returns the page HTML and any cookies set during the flow.
 */
async function fetchVideoPage(videoId: string, signal?: AbortSignal): Promise<{ html: string; cookies: Record<string, string> }> {
  const cookies: Record<string, string> = {};

  const doFetch = async (): Promise<string> => {
    const cookieStr = formatCookies(cookies);
    const resp = await fetch(WATCH_URL + videoId, {
      signal: signal ?? null,
      headers: {
        'Accept-Language': 'en-US',
        ...(cookieStr ? { 'Cookie': cookieStr } : {}),
      },
    });
    // Capture set-cookie headers (getSetCookie is standard but not in all TS lib typings)
    const headers = resp.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies: string[] = headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const kv = c.split(';')[0];
      if (kv) {
        const eqIdx = kv.indexOf('=');
        if (eqIdx > 0) {
          cookies[kv.substring(0, eqIdx)] = kv.substring(eqIdx + 1);
        }
      }
    }
    return resp.text();
  };

  let html = await doFetch();

  // Handle GDPR consent page
  if (html.includes('action="https://consent.youtube.com/s"')) {
    const match = html.match(/name="v" value="(.*?)"/);
    if (match?.[1]) {
      cookies['CONSENT'] = 'YES+' + match[1];
      html = await doFetch();
    }
  }

  return { html, cookies };
}

/**
 * Extracts the INNERTUBE_API_KEY from the YouTube page HTML.
 */
export function extractApiKey(html: string): string | null {
  const match = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  return match?.[1] ?? null;
}

/**
 * Calls the InnerTube player API with ANDROID client context to get
 * caption track URLs that work without PoToken authentication.
 */
async function fetchInnerTubeData(videoId: string, apiKey: string, cookies: Record<string, string>, signal?: AbortSignal): Promise<InnerTubeResponse> {
  const cookieStr = formatCookies(cookies);
  const resp = await fetch(INNERTUBE_API_URL + apiKey, {
    method: 'POST',
    signal: signal ?? null,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US',
      ...(cookieStr ? { 'Cookie': cookieStr } : {}),
    },
    body: JSON.stringify({
      context: INNERTUBE_CONTEXT,
      videoId,
    }),
  });

  if (!resp.ok) {
    throw new Error(`InnerTube API returned ${String(resp.status)}`);
  }

  return resp.json() as Promise<InnerTubeResponse>;
}

/**
 * Selects the best caption track: English manual > English ASR > first available.
 */
export function selectTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const enManual = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr');
  if (enManual) return enManual;

  const enAsr = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
  if (enAsr) return enAsr;

  return tracks[0];
}

/**
 * Decodes common HTML entities in caption text.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;#39;/g, "'");
}

/**
 * Parses YouTube's transcript XML format into timestamped lines.
 */
export function parseTranscriptXml(xml: string): string[] {
  const lines: string[] = [];
  const regex = /<text start="([^"]*)" dur="[^"]*">([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const startSec = parseFloat(match[1] ?? '0');
    const minutes = Math.floor(startSec / 60);
    const seconds = Math.floor(startSec % 60);
    const timestamp = `${String(minutes)}:${String(seconds).padStart(2, '0')}`;

    // Strip HTML tags and decode entities
    const rawText = match[2] ?? '';
    const text = decodeEntities(rawText.replace(/<[^>]*>/g, '')).trim();
    if (text) {
      lines.push(`[${timestamp}] ${text}`);
    }
  }

  return lines;
}

/**
 * Fetches a video's transcript using the InnerTube ANDROID client API.
 *
 * The approach:
 * 1. Fetch YouTube watch page to get the INNERTUBE_API_KEY and handle GDPR consent
 * 2. POST to InnerTube player API with ANDROID client context
 * 3. ANDROID client returns caption URLs without PoToken requirements
 * 4. Fetch caption XML and parse into timestamped lines
 */
export async function fetchTranscript(videoId: string, signal?: AbortSignal): Promise<Result<TranscriptResult, TranscriptError>> {
  try {
    // Step 1: Fetch page HTML (handles consent)
    const { html, cookies } = await fetchVideoPage(videoId, signal);

    // Step 2: Extract API key
    const apiKey = extractApiKey(html);
    if (!apiKey) {
      return { success: false, error: 'EXTRACTION_FAILED' };
    }

    // Step 3: Call InnerTube API with ANDROID client
    const data = await fetchInnerTubeData(videoId, apiKey, cookies, signal);

    const title = data.videoDetails?.title ?? 'Unknown';

    // Check playability
    if (data.playabilityStatus?.status === 'ERROR') {
      return { success: false, error: 'EXTRACTION_FAILED' };
    }

    // Step 4: Extract caption tracks
    const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      return { success: false, error: 'NO_CAPTIONS' };
    }

    // Step 5: Select best track
    const track = selectTrack(tracks);
    if (!track) {
      return { success: false, error: 'NO_CAPTIONS' };
    }

    // Strip fmt=srv3 from URL (get default XML format)
    const captionUrl = track.baseUrl.replace('&fmt=srv3', '');

    // Step 6: Fetch caption XML
    const cookieStr = formatCookies(cookies);
    const captionResp = await fetch(captionUrl, {
      signal: signal ?? null,
      headers: {
        'Accept-Language': 'en-US',
        ...(cookieStr ? { 'Cookie': cookieStr } : {}),
      },
    });

    if (!captionResp.ok) {
      return { success: false, error: 'EXTRACTION_FAILED' };
    }

    const xml = await captionResp.text();
    if (!xml || xml.length === 0) {
      return { success: false, error: 'NO_CAPTIONS' };
    }

    // Step 7: Parse XML into timestamped lines
    const lines = parseTranscriptXml(xml);
    if (lines.length === 0) {
      return { success: false, error: 'NO_CAPTIONS' };
    }

    return { success: true, data: { transcript: lines.join('\n'), title } };
  } catch (error) {
    if (error instanceof TypeError && (error as TypeError).message.includes('fetch')) {
      return { success: false, error: 'NETWORK_ERROR' };
    }
    return { success: false, error: 'EXTRACTION_FAILED' };
  }
}
