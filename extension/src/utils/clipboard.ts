/**
 * Formats summary content for clipboard with optional video metadata header.
 */
export function formatSummaryForClipboard(
  content: string,
  videoTitle?: string,
  videoUrl?: string
): string {
  if (!videoTitle && !videoUrl) {
    return content;
  }
  const header = [videoTitle, videoUrl].filter(Boolean).join('\n');
  return `${header}\n\n${content}`;
}
