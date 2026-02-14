const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL: 'Please enter a valid YouTube video URL',
  NO_CAPTIONS: 'No transcript available for this video',
  CONTEXT_TOO_LONG: 'This video is too long for the current model. Try a shorter video.',
  EXTRACTION_FAILED: 'Failed to extract transcript. Please try again.',
  API_ERROR: 'Failed to generate summary. Please try again.',
  NETWORK_ERROR: 'No internet connection. Please check your network.',
  INVALID_API_KEY: 'Failed to generate summary. Please try again.',
  RATE_LIMITED: 'Rate limited. Please try again later.',
};

export function getErrorMessage(code: string, fallback = 'An error occurred.'): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
