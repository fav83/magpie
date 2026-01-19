import type { CachedSummary } from '../types/prompt';
import type { AccordionItem } from '../types/accordion';
import { MAX_ACCORDION_ITEMS } from '../types/accordion';
import { STORAGE_KEYS } from '../config';
import { getPromptById } from './promptStorage';

/**
 * Schema version history for AccordionItem:
 *
 * v1 (initial): Core fields - id, videoId, videoTitle, videoUrl, promptId, promptName, modelId, summary, timestamp
 * v2 (added):   customPromptText?: string - Optional field for storing modified prompt text
 *               This field is optional, so old items work without migration.
 */

// Old format used videoId_promptId_modelId as key
type OldCacheEntry = CachedSummary;

// YouTube video IDs are always exactly 11 characters
const YOUTUBE_VIDEO_ID_LENGTH = 11;

function parseOldCacheKey(key: string): { videoId: string; promptId: string; modelId: string } | null {
  // Old format: {videoId}_{promptId}_{modelId}
  // videoId is always 11 chars, promptId is UUID or 'system-default', modelId is provider/model
  // Video IDs can contain underscores, so we use the fixed 11-char length

  // Minimum length: 11 (videoId) + 1 (_) + 1 (promptId min) + 1 (_) + 3 (modelId min like "a/b")
  if (key.length < YOUTUBE_VIDEO_ID_LENGTH + 6) return null;

  const videoId = key.slice(0, YOUTUBE_VIDEO_ID_LENGTH);
  if (key[YOUTUBE_VIDEO_ID_LENGTH] !== '_') return null;

  // Rest is {promptId}_{modelId} - modelId contains '/'
  const rest = key.slice(YOUTUBE_VIDEO_ID_LENGTH + 1);

  // Find where modelId starts by looking for the last segment that contains '/'
  // modelId format is "provider/model" (e.g., "openai/gpt-4o-mini")
  const parts = rest.split('_');
  if (parts.length < 2) return null;

  // Find where modelId starts (contains /)
  let modelIdStart = -1;
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i];
    if (part?.includes('/')) {
      modelIdStart = i;
      break;
    }
  }

  if (modelIdStart === -1) return null;

  const promptId = parts.slice(0, modelIdStart).join('_');
  const modelId = parts.slice(modelIdStart).join('_');

  if (!promptId || !modelId) return null;

  return { videoId, promptId, modelId };
}

export async function migrateOldCache(): Promise<void> {
  // Check if migration already done
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.MIGRATION_COMPLETE,
    STORAGE_KEYS.OLD_CACHE,
    STORAGE_KEYS.ACCORDION_ITEMS,
  ]);

  if (result[STORAGE_KEYS.MIGRATION_COMPLETE]) {
    return; // Already migrated
  }

  const oldCache = result[STORAGE_KEYS.OLD_CACHE] as Record<string, OldCacheEntry> | undefined;
  const existingItems = (result[STORAGE_KEYS.ACCORDION_ITEMS] as AccordionItem[] | undefined) ?? [];

  if (!oldCache || Object.keys(oldCache).length === 0) {
    // No old cache to migrate, just mark as complete
    await chrome.storage.local.set({ [STORAGE_KEYS.MIGRATION_COMPLETE]: true });
    return;
  }

  // Convert old cache entries to accordion items
  // Group by videoId_promptId (newest model wins)
  const groupedByVideoPrompt = new Map<string, { entry: OldCacheEntry; key: string; parsed: ReturnType<typeof parseOldCacheKey> }>();

  for (const [key, entry] of Object.entries(oldCache)) {
    const parsed = parseOldCacheKey(key);
    if (!parsed) continue;

    const groupKey = `${parsed.videoId}_${parsed.promptId}`;
    const existing = groupedByVideoPrompt.get(groupKey);

    if (!existing || entry.timestamp > existing.entry.timestamp) {
      groupedByVideoPrompt.set(groupKey, { entry, key, parsed });
    }
  }

  // Convert to accordion items
  const migratedItems: AccordionItem[] = [];

  for (const [id, { entry, parsed }] of groupedByVideoPrompt) {
    if (!parsed) continue;

    // Try to get prompt name
    let promptName = 'Unknown Prompt';
    try {
      const prompt = await getPromptById(parsed.promptId);
      if (prompt) {
        promptName = prompt.name;
      }
    } catch {
      // Prompt may have been deleted
    }

    migratedItems.push({
      id,
      videoId: parsed.videoId,
      videoTitle: entry.videoTitle,
      videoUrl: `https://www.youtube.com/watch?v=${parsed.videoId}`,
      promptId: parsed.promptId,
      promptName,
      modelId: entry.modelId,
      summary: entry.summary,
      timestamp: entry.timestamp || Date.now(),
    });
  }

  // Sort by timestamp descending, take only MAX_ACCORDION_ITEMS
  migratedItems.sort((a, b) => b.timestamp - a.timestamp);
  const finalItems = migratedItems.slice(0, MAX_ACCORDION_ITEMS);

  // Merge with any existing items (shouldn't happen but just in case)
  const existingIds = new Set(existingItems.map((item) => item.id));
  const newItems = finalItems.filter((item) => !existingIds.has(item.id));
  const mergedItems = [...existingItems, ...newItems]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ACCORDION_ITEMS);

  // Save migrated items and mark migration complete
  await chrome.storage.local.set({
    [STORAGE_KEYS.ACCORDION_ITEMS]: mergedItems,
    [STORAGE_KEYS.MIGRATION_COMPLETE]: true,
  });

  // Remove old cache
  await chrome.storage.local.remove(STORAGE_KEYS.OLD_CACHE);
}
