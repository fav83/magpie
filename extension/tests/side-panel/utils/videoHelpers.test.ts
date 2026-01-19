import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUsableTitle, getActiveTabInfo, fetchVideoInfo } from '../../../src/side-panel/utils/videoHelpers';
import { setupChromeMock, resetChromeMock, chromeMock } from '../../mocks/chrome';

setupChromeMock();

describe('videoHelpers', () => {
  beforeEach(() => {
    resetChromeMock();
    vi.clearAllMocks();
  });

  describe('isUsableTitle', () => {
    it('should return true for valid titles', () => {
      expect(isUsableTitle('My Video Title')).toBe(true);
      expect(isUsableTitle('Tutorial: How to Code')).toBe(true);
      expect(isUsableTitle('Introduction')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isUsableTitle('')).toBe(false);
    });

    it('should return false for whitespace-only strings', () => {
      expect(isUsableTitle('   ')).toBe(false);
      expect(isUsableTitle('\t\n')).toBe(false);
    });

    it('should return false for "Unknown" placeholder', () => {
      expect(isUsableTitle('Unknown')).toBe(false);
    });

    it('should return false for "YouTube" placeholder', () => {
      expect(isUsableTitle('YouTube')).toBe(false);
    });

    it('should handle titles with whitespace padding', () => {
      expect(isUsableTitle('  Unknown  ')).toBe(false);
      expect(isUsableTitle('  YouTube  ')).toBe(false);
      expect(isUsableTitle('  Valid Title  ')).toBe(true);
    });
  });

  describe('getActiveTabInfo', () => {
    it('should return tab info for YouTube video page', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 123,
        url: 'https://www.youtube.com/watch?v=abc123',
        title: 'Test Video',
      }]);

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(123);
      expect(result.videoId).toBe('abc123');
      expect(result.url).toBe('https://www.youtube.com/watch?v=abc123');
      expect(result.isOnYouTube).toBe(true);
    });

    it('should return null videoId for YouTube non-video page', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 456,
        url: 'https://www.youtube.com/playlist?list=PLxyz',
        title: 'Playlist',
      }]);

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(456);
      expect(result.videoId).toBe(null);
      expect(result.isOnYouTube).toBe(true);
    });

    it('should return isOnYouTube false for non-YouTube page', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        id: 789,
        url: 'https://google.com',
        title: 'Google',
      }]);

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(789);
      expect(result.videoId).toBe(null);
      expect(result.isOnYouTube).toBe(false);
    });

    it('should handle missing tab id', async () => {
      chromeMock.tabs.query.mockResolvedValue([{
        url: 'https://www.youtube.com/watch?v=test',
        title: 'Test',
      }]);

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(null);
      expect(result.videoId).toBe('test');
      expect(result.isOnYouTube).toBe(true);
    });

    it('should handle empty tab query result', async () => {
      chromeMock.tabs.query.mockResolvedValue([]);

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(null);
      expect(result.videoId).toBe(null);
      expect(result.url).toBe('');
      expect(result.isOnYouTube).toBe(false);
    });

    it('should handle chrome.tabs.query error', async () => {
      chromeMock.tabs.query.mockRejectedValue(new Error('Tab query failed'));

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(null);
      expect(result.videoId).toBe(null);
      expect(result.url).toBe('');
      expect(result.isOnYouTube).toBe(false);
    });

    it('should handle youtu.be short URLs (not supported)', async () => {
      // Note: extractVideoId only supports youtube.com/watch?v= format, not youtu.be
      chromeMock.tabs.query.mockResolvedValue([{
        id: 100,
        url: 'https://youtu.be/shortId',
        title: 'Short Video',
      }]);

      const result = await getActiveTabInfo();

      expect(result.tabId).toBe(100);
      expect(result.videoId).toBe(null); // youtu.be format not supported
      expect(result.isOnYouTube).toBe(false);
    });
  });

  describe('fetchVideoInfo', () => {
    it('should return video info on success', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'video123',
        videoTitle: 'Test Video Title',
        videoUrl: 'https://www.youtube.com/watch?v=video123',
      });

      const result = await fetchVideoInfo(123);

      expect(result).toEqual({
        videoId: 'video123',
        videoTitle: 'Test Video Title',
        videoUrl: 'https://www.youtube.com/watch?v=video123',
      });
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_VIDEO_INFO',
        tabId: 123,
      });
    });

    it('should return null on error response', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'VIDEO_INFO_ERROR',
        error: 'Not on YouTube video page',
      });

      const result = await fetchVideoInfo(123);

      expect(result).toBe(null);
    });

    it('should return null on exception', async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(new Error('Message failed'));

      const result = await fetchVideoInfo(123);

      expect(result).toBe(null);
    });

    it('should handle null tabId', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'video456',
        videoTitle: 'Another Video',
        videoUrl: 'https://www.youtube.com/watch?v=video456',
      });

      const result = await fetchVideoInfo(null);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_VIDEO_INFO',
        tabId: undefined,
      });
      expect(result?.videoId).toBe('video456');
    });

    it('should handle undefined tabId', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'video789',
        videoTitle: 'Video Without Tab',
        videoUrl: 'https://www.youtube.com/watch?v=video789',
      });

      const result = await fetchVideoInfo();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_VIDEO_INFO',
        tabId: undefined,
      });
      expect(result?.videoId).toBe('video789');
    });
  });
});
