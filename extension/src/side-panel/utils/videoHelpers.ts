import type { VideoInfoResponse } from '../../types/messages';
import { extractVideoId } from '../../utils/youtube';
import { INVALID_TITLES } from '../../config';

export interface TabInfo {
  tabId: number | null;
  videoId: string | null;
  url: string;
  isOnYouTube: boolean;
}

export interface VideoInfo {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
}

/**
 * Check if a title is usable (not empty and not an invalid placeholder)
 */
export function isUsableTitle(title: string): boolean {
  const normalized = title.trim();
  return normalized !== '' && !INVALID_TITLES.includes(normalized as typeof INVALID_TITLES[number]);
}

/**
 * Get basic tab info from chrome.tabs API (URL only, no title - title is unreliable)
 */
export async function getActiveTabInfo(): Promise<TabInfo> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    const isOnYouTube = url.includes('youtube.com');
    return {
      tabId: tab?.id ?? null,
      videoId: url ? extractVideoId(url) || null : null,
      url,
      isOnYouTube,
    };
  } catch {
    return { tabId: null, videoId: null, url: '', isOnYouTube: false };
  }
}

/**
 * Fetch video info (title, videoId, url) from the page context.
 * This is more reliable than tab.title because it reads from YouTube's page state.
 */
export async function fetchVideoInfo(tabId?: number | null): Promise<VideoInfo | null> {
  try {
    const response: VideoInfoResponse = await chrome.runtime.sendMessage({
      type: 'GET_VIDEO_INFO',
      tabId: tabId ?? undefined,
    });

    if (response.type === 'VIDEO_INFO_SUCCESS') {
      return {
        videoId: response.videoId,
        videoTitle: response.videoTitle,
        videoUrl: response.videoUrl,
      };
    }

    return null;
  } catch {
    return null;
  }
}
