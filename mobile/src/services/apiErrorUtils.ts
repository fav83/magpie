/**
 * Extract error message from OpenRouter error response.
 * OpenRouter errors can have nested structure with the actual error in metadata.raw
 */
export function extractErrorDetails(errorBody: string): string | undefined {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: {
        message?: string;
        metadata?: {
          raw?: string;
        };
      }
    };

    // Try to extract the nested error message from metadata.raw first
    if (parsed.error?.metadata?.raw) {
      try {
        const rawParsed = JSON.parse(parsed.error.metadata.raw) as { message?: string };
        if (rawParsed.message) {
          return rawParsed.message;
        }
      } catch {
        // If raw is not valid JSON, use it directly if short enough
        if (parsed.error.metadata.raw.length < 200) {
          return parsed.error.metadata.raw;
        }
      }
    }

    // Fall back to the top-level error message
    return parsed.error?.message;
  } catch {
    // If not JSON, return the raw body if it's not too long
    if (errorBody && errorBody.length < 200) {
      return errorBody;
    }
    return undefined;
  }
}
