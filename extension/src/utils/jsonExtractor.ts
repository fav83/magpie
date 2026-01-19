/**
 * Extract a JSON object from a string starting at a given index.
 * Handles nested objects, strings with escaped characters, etc.
 */
export function extractJsonObject(
  content: string,
  startIndex: number
): string | null {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        return content.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Extract JSON from a script tag containing a specific marker
 */
export function extractJsonFromScriptContent(
  content: string,
  marker: string
): unknown {
  const startIndex = content.indexOf(marker);
  if (startIndex === -1) {
    return null;
  }

  const jsonStart = content.indexOf('{', startIndex);
  if (jsonStart === -1) {
    return null;
  }

  const jsonString = extractJsonObject(content, jsonStart);
  if (!jsonString) {
    return null;
  }

  try {
    return JSON.parse(jsonString) as unknown;
  } catch {
    return null;
  }
}
