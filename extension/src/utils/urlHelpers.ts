/**
 * Set a URL parameter, handling both valid URLs and edge cases
 */
export function setUrlParam(url: string, key: string, value: string): string {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set(key, value);
    return parsedUrl.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${key}=${value}`;
  }
}

/**
 * Extract a URL parameter value
 */
export function extractUrlParam(
  url: string,
  param: string,
  base?: string
): string {
  try {
    const parsed = new URL(url, base);
    return parsed.searchParams.get(param) ?? '';
  } catch {
    return '';
  }
}

/**
 * Build an unsigned timedtext caption URL
 */
export function buildUnsignedCaptionUrl(
  videoId: string,
  languageCode: string,
  kind?: string
): string {
  const url = new URL('https://www.youtube.com/api/timedtext');
  url.searchParams.set('v', videoId);
  url.searchParams.set('lang', languageCode);
  if (kind) {
    url.searchParams.set('kind', kind);
  }
  url.searchParams.set('fmt', 'json3');
  return url.toString();
}
