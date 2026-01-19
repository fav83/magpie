import type { Json3Transcript } from '../types/transcript';

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&nbsp;/g, ' ');
}

/**
 * Format seconds into [MM:SS] or [H:MM:SS] timestamp
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `[${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  }
  return `[${minutes}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Parse XML transcript format (timedtext) with timestamps
 */
export function parseTranscriptXml(xml: string): string {
  if (!xml) {
    return '';
  }

  // Match text elements with start attribute
  const textPattern = /<text[^>]*\sstart="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  const segments: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = textPattern.exec(xml)) !== null) {
    const startTime = parseFloat(match[1] ?? '0');
    const text = match[2];
    if (text) {
      const decodedText = decodeHtmlEntities(text).trim();
      if (decodedText) {
        segments.push(`${formatTimestamp(startTime)} ${decodedText}`);
      }
    }
  }

  if (segments.length === 0) {
    return '';
  }

  return segments.join('\n');
}

/**
 * Parse JSON3 transcript format with timestamps
 */
export function parseTranscriptJson(jsonText: string): string {
  if (!jsonText) {
    return '';
  }

  try {
    const data = JSON.parse(jsonText) as Json3Transcript;

    const segments: string[] = [];
    for (const event of data.events ?? []) {
      const segmentText = (event.segs ?? [])
        .map((segment) => segment.utf8 ?? '')
        .join('')
        .trim();
      if (segmentText) {
        const startSeconds = (event.tStartMs ?? 0) / 1000;
        segments.push(`${formatTimestamp(startSeconds)} ${segmentText}`);
      }
    }

    return segments.join('\n');
  } catch {
    return '';
  }
}

/**
 * Parse transcript payload - tries JSON first, then XML
 */
export function parseTranscriptPayload(body: string): string {
  if (!body) {
    return '';
  }

  const jsonTranscript = parseTranscriptJson(body);
  if (jsonTranscript) {
    return jsonTranscript;
  }

  return parseTranscriptXml(body);
}
