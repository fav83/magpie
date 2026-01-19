import type { VideoInfoResponse } from '../types/messages';

/**
 * Lightweight function to extract video info from the page context.
 * Executed in MAIN world to access YouTube's page state.
 * This is much faster than full transcript extraction.
 */
export async function extractVideoInfoInPage(expectedVideoId: string, debugMode = false): Promise<VideoInfoResponse> {
  // Helper to safely log - only in debug mode
  const log = (...args: unknown[]) => {
    if (debugMode) console.log('[YT-Summarizer:VideoInfo]', ...args);
  };

  try {
    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');

    if (!videoId) {
      return { type: 'VIDEO_INFO_ERROR', error: 'No video ID in URL' };
    }

    // Verify we're on the expected video
    if (videoId !== expectedVideoId) {
      log('Video ID mismatch:', videoId, 'vs expected:', expectedVideoId);
      // Return the actual video info anyway - the caller can decide what to do
    }

    const getPageVideoId = (): string | null => {
      const watchFlexy = document.querySelector('ytd-watch-flexy');
      const flexyVideoId = watchFlexy?.getAttribute('video-id');
      if (flexyVideoId) return flexyVideoId;

      const metaVideoId = document.querySelector('meta[itemprop="videoId"]')?.getAttribute('content');
      return metaVideoId ?? null;
    };

    const getPlayerVideoData = (): { title?: string; video_id?: string } | null => {
      try {
        const player = document.getElementById('movie_player') as unknown as {
          getVideoData?: () => { title?: string; video_id?: string };
        } | null;
        return player?.getVideoData?.() ?? null;
      } catch {
        return null;
      }
    };

    const waitForVideoReady = async (): Promise<void> => {
      const maxAttempts = 10;
      const delayMs = 200;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const playerVideoId = getPlayerVideoData()?.video_id ?? null;
        const pageVideoId = getPageVideoId();
        if (playerVideoId === videoId || pageVideoId === videoId) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    };

    await waitForVideoReady();

    const pageVideoId = getPageVideoId();
    const canUseDomTitle = !pageVideoId || pageVideoId === videoId;
    if (pageVideoId && pageVideoId !== videoId) {
      log('Page video ID mismatch:', pageVideoId, 'vs URL video ID:', videoId);
    }

    // Try to get title from multiple sources (fastest to slowest)
    let videoTitle = 'Unknown';

    // Source 1: ytInitialPlayerResponse (available immediately on page load)
    try {
      const playerResponse = (window as unknown as Record<string, unknown>).ytInitialPlayerResponse as
        | { videoDetails?: { title?: string; videoId?: string } }
        | undefined;

      if (playerResponse?.videoDetails?.title && playerResponse.videoDetails.videoId === videoId) {
        videoTitle = playerResponse.videoDetails.title;
        log('Title from ytInitialPlayerResponse:', videoTitle);
      }
    } catch {
      // Ignore errors accessing window properties
    }

    // Source 1b: movie_player.getVideoData (often updated before DOM)
    if (videoTitle === 'Unknown') {
      const videoData = getPlayerVideoData();
      if (videoData?.title && videoData.video_id === videoId) {
        videoTitle = videoData.title;
        log('Title from movie_player.getVideoData:', videoTitle);
      }
    }

    // Source 2: DOM title element
    if (videoTitle === 'Unknown' && canUseDomTitle) {
      const titleElement = document.querySelector(
        'h1.ytd-video-primary-info-renderer yt-formatted-string, ' +
        'h1.ytd-watch-metadata yt-formatted-string'
      );
      if (titleElement?.textContent) {
        videoTitle = titleElement.textContent.trim();
        log('Title from DOM h1:', videoTitle);
      }
    }

    // Source 3: Meta tags
    if (videoTitle === 'Unknown' && canUseDomTitle) {
      const titleMeta = document.querySelector('meta[name="title"]');
      if (titleMeta?.getAttribute('content')) {
        videoTitle = titleMeta.getAttribute('content') ?? 'Unknown';
        log('Title from meta[name=title]:', videoTitle);
      }
    }

    // Source 4: Open Graph title
    if (videoTitle === 'Unknown' && canUseDomTitle) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle?.getAttribute('content')) {
        videoTitle = ogTitle.getAttribute('content') ?? 'Unknown';
        log('Title from og:title:', videoTitle);
      }
    }

    // Source 5: Document title (last resort)
    if (videoTitle === 'Unknown' && canUseDomTitle) {
      const docTitle = document.title.replace(' - YouTube', '').trim();
      if (docTitle && docTitle !== 'YouTube') {
        videoTitle = docTitle;
        log('Title from document.title:', videoTitle);
      }
    }

    log('Final title:', videoTitle, 'for video:', videoId);

    return {
      type: 'VIDEO_INFO_SUCCESS',
      videoId,
      videoTitle,
      videoUrl: window.location.href,
    };
  } catch (error) {
    log('Error extracting video info:', error);
    return { type: 'VIDEO_INFO_ERROR', error: String(error) };
  }
}
