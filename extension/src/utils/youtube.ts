/**
 * Extract video ID from a YouTube URL.
 *
 * NOTE: This function is duplicated in transcriptExtractor.ts as extractVideoIdFromUrl()
 * because that file runs in MAIN world context and cannot import modules.
 * If you modify this logic, also update the MAIN world version.
 *
 * @param url - YouTube video URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
 * @returns The video ID or empty string if not found
 */
export function extractVideoId(url: string): string {
  try {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v') ?? '';
  } catch {
    return '';
  }
}

/**
 * Check if a URL is a YouTube video page
 * @param url - URL to check
 * @returns true if URL is a YouTube video page
 */
export function isYouTubeVideoUrl(url: string): boolean {
  return url.includes('youtube.com/watch');
}
