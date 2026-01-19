import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccordionItems,
  getAccordionItem,
  hasAccordionItem,
  upsertAccordionItem,
  removeAccordionItem,
  removeAccordionItemByVideo,
  clearAccordion,
  getAccordionItemsForVideo,
  getMostRecentItemForVideo,
  buildItemId,
  parseItemId,
} from '../../src/utils/accordionStorage';
import { MAX_ACCORDION_ITEMS } from '../../src/types/accordion';
import type { AccordionItem } from '../../src/types/accordion';
import { STORAGE_KEYS } from '../../src/config';
import { chromeMock, setupChromeMock, resetChromeMock } from '../mocks/chrome';

describe('accordionStorage', () => {
  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
  });

  // YouTube video IDs are always 11 characters
  const TEST_VIDEO_ID = 'dQw4w9WgXcQ'; // 11 chars

  const createItem = (overrides: Partial<AccordionItem> = {}): AccordionItem => ({
    id: `${TEST_VIDEO_ID}_prompt1`,
    videoId: TEST_VIDEO_ID,
    videoTitle: 'Test Video',
    videoUrl: `https://youtube.com/watch?v=${TEST_VIDEO_ID}`,
    promptId: 'prompt1',
    promptName: 'Default Summary',
    modelId: 'openai/gpt-4o-mini',
    summary: 'Test summary',
    timestamp: Date.now(),
    ...overrides,
  });

  describe('buildItemId', () => {
    it('should create id from videoId and promptId', () => {
      expect(buildItemId('abc123', 'prompt-uuid')).toBe('abc123_prompt-uuid');
    });
  });

  describe('parseItemId', () => {
    it('should parse valid item id', () => {
      // 11-char video ID + underscore + promptId
      expect(parseItemId('dQw4w9WgXcQ_prompt1')).toEqual({
        videoId: 'dQw4w9WgXcQ',
        promptId: 'prompt1',
      });
    });

    it('should handle prompt ids with underscores', () => {
      expect(parseItemId('dQw4w9WgXcQ_prompt_with_underscores')).toEqual({
        videoId: 'dQw4w9WgXcQ',
        promptId: 'prompt_with_underscores',
      });
    });

    it('should handle video ids with underscores', () => {
      // Video ID with underscore: abc_def_ghij (11 chars)
      expect(parseItemId('abc_def_ghi_prompt1')).toEqual({
        videoId: 'abc_def_ghi',
        promptId: 'prompt1',
      });
    });

    it('should handle video ids with dashes', () => {
      // Video ID with dash: abc-def-ghi (11 chars)
      expect(parseItemId('abc-def-ghi_prompt1')).toEqual({
        videoId: 'abc-def-ghi',
        promptId: 'prompt1',
      });
    });

    it('should return null for invalid ids', () => {
      expect(parseItemId('invalid')).toBeNull();
      expect(parseItemId('')).toBeNull();
      expect(parseItemId('short_p')).toBeNull(); // video ID too short
    });
  });

  describe('getAccordionItems', () => {
    it('should return empty array when no items', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      const items = await getAccordionItems();

      expect(items).toEqual([]);
    });

    it('should return items sorted by timestamp descending', async () => {
      const older = createItem({ id: 'dQw4w9WgXcQ_p1', timestamp: 1000 });
      const newer = createItem({ id: 'xxxxxxxxxxx_p1', videoId: 'xxxxxxxxxxx', timestamp: 2000 });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [older, newer],
      });

      const items = await getAccordionItems();

      expect(items).toHaveLength(2);
      expect(items[0]?.timestamp).toBe(2000);
      expect(items[1]?.timestamp).toBe(1000);
    });
  });

  describe('getAccordionItem', () => {
    it('should return item when found', async () => {
      const item = createItem();
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [item],
      });

      const result = await getAccordionItem(TEST_VIDEO_ID, 'prompt1');

      expect(result).toEqual(item);
    });

    it('should return null when not found', async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [],
      });

      const result = await getAccordionItem(TEST_VIDEO_ID, 'prompt1');

      expect(result).toBeNull();
    });
  });

  describe('hasAccordionItem', () => {
    it('should return true when item exists', async () => {
      const item = createItem();
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [item],
      });

      expect(await hasAccordionItem(TEST_VIDEO_ID, 'prompt1')).toBe(true);
    });

    it('should return false when item does not exist', async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [],
      });

      expect(await hasAccordionItem(TEST_VIDEO_ID, 'prompt1')).toBe(false);
    });
  });

  describe('upsertAccordionItem', () => {
    it('should add new item', async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [],
      });

      const result = await upsertAccordionItem({
        videoId: TEST_VIDEO_ID,
        videoTitle: 'Test',
        videoUrl: `https://youtube.com/watch?v=${TEST_VIDEO_ID}`,
        promptId: 'prompt1',
        promptName: 'Default',
        modelId: 'openai/gpt-4o-mini',
        summary: 'Summary',
      });

      expect(result.isNew).toBe(true);
      expect(result.removedItem).toBeNull();
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    it('should replace existing item with same video+prompt', async () => {
      const existing = createItem({ summary: 'Old summary' });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [existing],
      });

      const result = await upsertAccordionItem({
        videoId: TEST_VIDEO_ID,
        videoTitle: 'Test',
        videoUrl: `https://youtube.com/watch?v=${TEST_VIDEO_ID}`,
        promptId: 'prompt1',
        promptName: 'Default',
        modelId: 'different-model',
        summary: 'New summary',
      });

      expect(result.isNew).toBe(false);
      expect(result.removedItem).toBeNull();
    });

    it('should remove oldest item when at capacity', async () => {
      // Create MAX_ACCORDION_ITEMS items
      const items = Array.from({ length: MAX_ACCORDION_ITEMS }, (_, i) =>
        createItem({
          id: `video${i}_prompt1`,
          videoId: `video${i}`,
          timestamp: 1000 + i,
        })
      );
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: items,
      });

      const result = await upsertAccordionItem({
        videoId: 'newVideo',
        videoTitle: 'New',
        videoUrl: 'https://youtube.com/watch?v=newVideo',
        promptId: 'prompt1',
        promptName: 'Default',
        modelId: 'openai/gpt-4o-mini',
        summary: 'New summary',
      });

      expect(result.isNew).toBe(true);
      expect(result.removedItem).not.toBeNull();
      expect(result.removedItem).toBeDefined();
      if (result.removedItem) {
        expect(result.removedItem.timestamp).toBe(1000); // Oldest
      }
    });
  });

  describe('removeAccordionItem', () => {
    it('should remove item by id', async () => {
      const item = createItem();
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [item],
      });

      const removed = await removeAccordionItem(`${TEST_VIDEO_ID}_prompt1`);

      expect(removed).toEqual(item);
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [],
      });
    });

    it('should return null when item not found', async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [],
      });

      const removed = await removeAccordionItem('nonexistent');

      expect(removed).toBeNull();
    });
  });

  describe('removeAccordionItemByVideo', () => {
    it('should remove item by videoId and promptId', async () => {
      const item = createItem();
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [item],
      });

      const removed = await removeAccordionItemByVideo(TEST_VIDEO_ID, 'prompt1');

      expect(removed).toEqual(item);
    });
  });

  describe('clearAccordion', () => {
    it('should clear all items', async () => {
      await clearAccordion();

      expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(STORAGE_KEYS.ACCORDION_ITEMS);
    });
  });

  describe('getAccordionItemsForVideo', () => {
    it('should return only items for specified video', async () => {
      const item1 = createItem({ id: `${TEST_VIDEO_ID}_prompt1` });
      const item2 = createItem({ id: `${TEST_VIDEO_ID}_prompt2`, promptId: 'prompt2' });
      const item3 = createItem({ id: 'xxxxxxxxxxx_prompt1', videoId: 'xxxxxxxxxxx' });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [item1, item2, item3],
      });

      const items = await getAccordionItemsForVideo(TEST_VIDEO_ID);

      expect(items).toHaveLength(2);
      expect(items.every(i => i.videoId === TEST_VIDEO_ID)).toBe(true);
    });
  });

  describe('getMostRecentItemForVideo', () => {
    it('should return most recent item for video', async () => {
      const older = createItem({ id: `${TEST_VIDEO_ID}_prompt1`, timestamp: 1000 });
      const newer = createItem({
        id: `${TEST_VIDEO_ID}_prompt2`,
        promptId: 'prompt2',
        timestamp: 2000,
      });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [older, newer],
      });

      const result = await getMostRecentItemForVideo(TEST_VIDEO_ID);

      expect(result?.timestamp).toBe(2000);
    });

    it('should return null when no items for video', async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.ACCORDION_ITEMS]: [],
      });

      const result = await getMostRecentItemForVideo(TEST_VIDEO_ID);

      expect(result).toBeNull();
    });
  });
});
