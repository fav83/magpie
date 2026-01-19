import { useState, useCallback, useEffect, useRef } from 'react';
import { ERROR_MESSAGES, UI_MESSAGES, STORAGE_KEYS } from '../../config';
import { getMostRecentItemForVideo } from '../../utils/accordionStorage';
import { getDefaultPromptAndModel } from '../../utils/promptStorage';
import { migrateOldCache } from '../../utils/migration';
import { getActiveTabInfo, fetchVideoInfo, isUsableTitle, TabInfo } from '../utils/videoHelpers';
import { logComponent } from '../../utils/logger';
import { useChromeStorage } from '../../hooks/useChromeStorage';

const NAV_LOG = 'VideoNavigation';

// Freeze diagnostic logging - only logs when operation is slow or state changes
const logFreezeDiag = (context: string, data: Record<string, unknown>) => {
  logComponent(`${NAV_LOG}][FREEZE][${context}`, data);
};

export interface VideoNavigationCallbacks {
  loadItems: () => Promise<void>;
  generateSummary: (
    videoId: string,
    videoTitle: string,
    videoUrl: string,
    promptId: string,
    modelId: string,
    isModelChange?: boolean,
    replaceItemId?: string
  ) => void;
  expandItem: (id: string) => void;
  stopAllStreamsForOtherVideos: (currentVideoId: string) => void;
  collapseOtherVideos: (currentVideoId: string) => void;
  currentTabIdRef: React.MutableRefObject<number | null>;
}

export interface UseVideoNavigationReturn {
  currentVideoId: string | null;
  error: string;
  isInitializing: boolean;
  setError: (error: string) => void;
  generateForCurrentVideo: (promptId: string, modelId: string) => Promise<void>;
}

/**
 * Helper to fetch video info and generate summary with appropriate title
 */
async function generateWithVideoInfo(
  tabInfo: TabInfo,
  promptId: string,
  modelId: string,
  generateSummary: VideoNavigationCallbacks['generateSummary']
): Promise<void> {
  if (!tabInfo.videoId) {
    return;
  }

  const videoInfo = await fetchVideoInfo(tabInfo.tabId);

  if (videoInfo?.videoId === tabInfo.videoId && isUsableTitle(videoInfo.videoTitle)) {
    generateSummary(videoInfo.videoId, videoInfo.videoTitle, videoInfo.videoUrl, promptId, modelId);
  } else {
    generateSummary(tabInfo.videoId, UI_MESSAGES.LOADING_TITLE, tabInfo.url, promptId, modelId);
  }
}

/**
 * Helper to handle summary for a video - expand existing or generate new if API key present
 */
async function handleVideoSummary(
  videoId: string,
  apiKey: string | null | undefined,
  tabInfo: TabInfo,
  expandItem: (id: string) => void,
  generateSummary: VideoNavigationCallbacks['generateSummary']
): Promise<void> {
  const existingItem = await getMostRecentItemForVideo(videoId);

  if (existingItem) {
    expandItem(existingItem.id);
  } else if (apiKey) {
    const { promptId, modelId } = await getDefaultPromptAndModel();
    await generateWithVideoInfo(tabInfo, promptId, modelId, generateSummary);
  }
}

/**
 * Manages video navigation detection and automatic summary generation.
 * Handles tab changes, URL updates, and initialization.
 */
export function useVideoNavigation(callbacks: VideoNavigationCallbacks): UseVideoNavigationReturn {
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isInitComplete, setIsInitComplete] = useState(false);
  const currentVideoIdRef = useRef<string | null>(null);

  // Check for API key - needed to decide whether to auto-generate
  const [apiKey, , isApiKeyLoading] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);
  const apiKeyRef = useRef<string | null>(null);

  // Keep apiKeyRef in sync with apiKey state
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  // isInitializing is true until both API key loading and init are complete
  const isInitializing = !isInitComplete || isApiKeyLoading;

  const { loadItems, generateSummary, expandItem, stopAllStreamsForOtherVideos, collapseOtherVideos, currentTabIdRef } = callbacks;

  // Handle video navigation
  const handleVideoChange = useCallback(
    async (tabInfo: TabInfo) => {
      const startTime = performance.now();

      logComponent(NAV_LOG, 'handleVideoChange:', {
        videoId: tabInfo.videoId,
        tabId: tabInfo.tabId,
        isOnYouTube: tabInfo.isOnYouTube,
      });

      if (!tabInfo.videoId) {
        // Navigated away from video
        if (tabInfo.isOnYouTube) {
          logComponent(NAV_LOG, 'On YouTube but not on video page');
          setCurrentVideoId(null);
          setError(ERROR_MESSAGES.NOT_YOUTUBE_VIDEO);
        }
        currentTabIdRef.current = tabInfo.tabId;
        return;
      }

      const newVideoId = tabInfo.videoId;
      const newTabId = tabInfo.tabId ?? null;

      if (newVideoId === currentVideoIdRef.current) {
        currentTabIdRef.current = newTabId;
        return; // Same video, no change
      }

      logComponent(NAV_LOG, 'Video changed:', currentVideoIdRef.current, '->', newVideoId);

      // Stop any ongoing streams for other videos before switching
      stopAllStreamsForOtherVideos(newVideoId);

      // Collapse all items for other videos
      collapseOtherVideos(newVideoId);

      currentVideoIdRef.current = newVideoId;
      currentTabIdRef.current = newTabId;

      setCurrentVideoId(newVideoId);
      setError('');

      // Check for existing summary or generate new one
      await handleVideoSummary(newVideoId, apiKeyRef.current, tabInfo, expandItem, generateSummary);

      const elapsed = performance.now() - startTime;
      if (elapsed > 100) {
        logFreezeDiag('video-change-slow', { videoId: newVideoId, elapsedMs: elapsed.toFixed(2) });
      }
    },
    [generateSummary, expandItem, stopAllStreamsForOtherVideos, collapseOtherVideos, currentTabIdRef]
  );

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const startTime = performance.now();
      logComponent(NAV_LOG, 'Initializing side panel...');

      // Run migration from old cache format
      await migrateOldCache();
      await loadItems();

      // Check for API key directly from storage to avoid race condition with hook state
      const storage = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
      const storedApiKey = storage[STORAGE_KEYS.API_KEY] as string | undefined;
      logComponent(NAV_LOG, 'API key present:', !!storedApiKey);

      const tabInfo = await getActiveTabInfo();
      logComponent(NAV_LOG, 'Active tab:', {
        videoId: tabInfo.videoId,
        tabId: tabInfo.tabId,
        isOnYouTube: tabInfo.isOnYouTube,
      });

      currentTabIdRef.current = tabInfo.tabId;
      setIsInitComplete(true);

      if (tabInfo.videoId) {
        currentVideoIdRef.current = tabInfo.videoId;
        setCurrentVideoId(tabInfo.videoId);
        await handleVideoSummary(tabInfo.videoId, storedApiKey, tabInfo, expandItem, generateSummary);
      } else if (tabInfo.isOnYouTube) {
        setError(ERROR_MESSAGES.NOT_YOUTUBE_VIDEO);
      }

      const elapsed = performance.now() - startTime;
      logComponent(NAV_LOG, `Initialization complete (${elapsed.toFixed(0)}ms)`);
      if (elapsed > 500) {
        logFreezeDiag('init-slow', { elapsedMs: elapsed.toFixed(2), videoId: tabInfo.videoId });
      }
    };

    void init();
  }, [loadItems, generateSummary, expandItem, currentTabIdRef]);

  // Listen for video navigation
  useEffect(() => {
    // Track pending navigation to avoid duplicate processing
    let navigationInProgress = false;
    let lastNavigationTime = 0;

    const handleUrlChange = async () => {
      const now = performance.now();
      const timeSinceLastNav = now - lastNavigationTime;

      // Debounce rapid navigation events (common during SPA navigation)
      if (timeSinceLastNav < 100 && navigationInProgress) {
        return;
      }

      navigationInProgress = true;
      lastNavigationTime = now;

      try {
        const tabInfo = await getActiveTabInfo();
        await handleVideoChange(tabInfo);
      } finally {
        navigationInProgress = false;
      }
    };

    const handleTabUpdate = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.url && tab.active) {
        void handleUrlChange();
      }
    };

    const handleHistoryStateUpdate = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails
    ) => {
      if (details.url.includes('youtube.com')) {
        void handleUrlChange();
      }
    };

    const handleTabActivated = () => {
      void handleUrlChange();
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.webNavigation.onHistoryStateUpdated.addListener(handleHistoryStateUpdate);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.webNavigation.onHistoryStateUpdated.removeListener(handleHistoryStateUpdate);
    };
  }, [handleVideoChange]);

  // Generate summary for current video with specified prompt and model
  const generateForCurrentVideo = useCallback(async (promptId: string, modelId: string) => {
    const tabInfo = await getActiveTabInfo();
    if (!tabInfo.videoId) return;
    currentTabIdRef.current = tabInfo.tabId;

    await generateWithVideoInfo(tabInfo, promptId, modelId, generateSummary);
  }, [generateSummary, currentTabIdRef]);

  return {
    currentVideoId,
    error,
    isInitializing,
    setError,
    generateForCurrentVideo,
  };
}
