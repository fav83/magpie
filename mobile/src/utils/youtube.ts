/**
 * Extract video ID from a YouTube URL.
 * Handles:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 */
export function extractVideoId(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] ?? '';
    }
    return new URLSearchParams(parsed.search).get('v') ?? '';
  } catch {
    return '';
  }
}

/**
 * Extract the first YouTube URL from arbitrary text.
 * Unlike extractVideoId (which expects a clean URL), this scans text like
 * "Check this out: https://youtu.be/abc123 it's great" for embedded URLs.
 */
export function extractYouTubeUrl(text: string): string | null {
  // Match any https/http URL, then validate with isValidYouTubeUrl
  const urlPattern = /https?:\/\/[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    if (isValidYouTubeUrl(match[0])) return match[0];
  }
  return null;
}

/**
 * Check if a URL is a valid YouTube video URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'];
    if (!validHosts.includes(parsed.hostname)) return false;
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.length > 1;
    }
    return parsed.pathname === '/watch' && parsed.searchParams.has('v');
  } catch {
    return false;
  }
}
