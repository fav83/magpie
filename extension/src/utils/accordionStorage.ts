import type { AccordionItem } from '../types/accordion';
import { MAX_ACCORDION_ITEMS } from '../types/accordion';
import { STORAGE_KEYS } from '../config';

function buildItemId(videoId: string, promptId: string): string {
  return `${videoId}_${promptId}`;
}

// YouTube video IDs are always exactly 11 characters
const YOUTUBE_VIDEO_ID_LENGTH = 11;

export function parseItemId(id: string): { videoId: string; promptId: string } | null {
  // Format: {videoId}_{promptId} where videoId is always 11 chars
  // Video IDs can contain underscores, so we can't split by '_'
  if (id.length < YOUTUBE_VIDEO_ID_LENGTH + 2) return null; // min: 11 + '_' + 1 char promptId

  const videoId = id.slice(0, YOUTUBE_VIDEO_ID_LENGTH);
  const separator = id[YOUTUBE_VIDEO_ID_LENGTH];
  if (separator !== '_') return null;

  const promptId = id.slice(YOUTUBE_VIDEO_ID_LENGTH + 1);
  if (!promptId) return null;

  return { videoId, promptId };
}

async function getItems(): Promise<AccordionItem[]> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.ACCORDION_ITEMS]);
  return (result[STORAGE_KEYS.ACCORDION_ITEMS] as AccordionItem[] | undefined) ?? [];
}

async function saveItems(items: AccordionItem[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACCORDION_ITEMS]: items });
}

export async function getAccordionItems(): Promise<AccordionItem[]> {
  const items = await getItems();
  // Sort by timestamp descending (newest first)
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getAccordionItem(
  videoId: string,
  promptId: string
): Promise<AccordionItem | null> {
  const items = await getItems();
  const id = buildItemId(videoId, promptId);
  return items.find((item) => item.id === id) ?? null;
}

export async function hasAccordionItem(
  videoId: string,
  promptId: string
): Promise<boolean> {
  const item = await getAccordionItem(videoId, promptId);
  return item !== null;
}

export async function upsertAccordionItem(
  item: Omit<AccordionItem, 'id' | 'timestamp'>
): Promise<{ isNew: boolean; removedItem: AccordionItem | null }> {
  const items = await getItems();
  const id = buildItemId(item.videoId, item.promptId);
  const existingIndex = items.findIndex((i) => i.id === id);

  const newItem: AccordionItem = {
    ...item,
    id,
    timestamp: Date.now(),
  };

  let removedItem: AccordionItem | null = null;
  let isNew = false;

  if (existingIndex >= 0) {
    // Replace existing item in place (model change scenario)
    items[existingIndex] = newItem;
  } else {
    // New item - add to beginning
    isNew = true;

    // Check if we need to remove oldest item (FIFO cleanup)
    if (items.length >= MAX_ACCORDION_ITEMS) {
      // Sort by timestamp ascending to find oldest
      const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
      const oldest = sorted[0];
      if (oldest) {
        removedItem = oldest;
        // Remove oldest from items array
        const oldestIndex = items.findIndex((i) => i.id === oldest.id);
        if (oldestIndex >= 0) {
          items.splice(oldestIndex, 1);
        }
      }
    }

    items.unshift(newItem);
  }

  await saveItems(items);
  return { isNew, removedItem };
}

export async function removeAccordionItem(id: string): Promise<AccordionItem | null> {
  const items = await getItems();
  const index = items.findIndex((item) => item.id === id);

  if (index < 0) return null;

  const [removed] = items.splice(index, 1);
  await saveItems(items);
  return removed ?? null;
}

export async function removeAccordionItemByVideo(
  videoId: string,
  promptId: string
): Promise<AccordionItem | null> {
  const id = buildItemId(videoId, promptId);
  return removeAccordionItem(id);
}

export async function clearAccordion(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.ACCORDION_ITEMS);
}

export async function getAccordionItemsForVideo(
  videoId: string
): Promise<AccordionItem[]> {
  const items = await getAccordionItems();
  return items.filter((item) => item.videoId === videoId);
}

export async function getMostRecentItemForVideo(
  videoId: string
): Promise<AccordionItem | null> {
  const items = await getAccordionItemsForVideo(videoId);
  // Already sorted by timestamp desc
  return items[0] ?? null;
}

export { buildItemId };
