import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractVideoInfoInPage } from '../../src/service-worker/videoInfoExtractor';

let originalLocation: Location;

const mockLocation = (videoId: string | null) => {
  const url = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : 'https://www.youtube.com/';

  Object.defineProperty(window, 'location', {
    value: {
      ...originalLocation,
      href: url,
      search: videoId ? `?v=${videoId}` : '',
    },
    writable: true,
    configurable: true,
  });
};

const setWatchFlexyVideoId = (videoId: string) => {
  const flexy = document.querySelector('ytd-watch-flexy') ?? document.createElement('ytd-watch-flexy');
  flexy.setAttribute('video-id', videoId);
  if (!flexy.isConnected) {
    document.body.appendChild(flexy);
  }
};

const setDomTitle = (title: string) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<h1 class="ytd-watch-metadata"><yt-formatted-string>${title}</yt-formatted-string></h1>`
  );
};

const setPlayerVideoData = (videoId: string, title: string) => {
  const player = document.createElement('div') as HTMLDivElement & {
    getVideoData?: () => { title?: string; video_id?: string };
  };
  player.id = 'movie_player';
  player.getVideoData = () => ({ title, video_id: videoId });
  document.body.appendChild(player);
};

describe('extractVideoInfoInPage', () => {
  beforeEach(() => {
    originalLocation = window.location;
    document.body.innerHTML = '';
    document.title = 'YouTube';
    (window as unknown as Record<string, unknown>).ytInitialPlayerResponse = undefined;
    mockLocation('new123');
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('error handling', () => {
    it('returns error when no video ID in URL', async () => {
      mockLocation(null);

      const result = await extractVideoInfoInPage('abc123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_ERROR',
        error: 'No video ID in URL',
      });
    });
  });

  describe('title sources priority', () => {
    it('uses ytInitialPlayerResponse as primary source', async () => {
      (window as unknown as Record<string, unknown>).ytInitialPlayerResponse = {
        videoDetails: {
          title: 'Initial Player Title',
          videoId: 'new123',
        },
      };
      setDomTitle('DOM Title');

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Initial Player Title',
        videoUrl: window.location.href,
      });
    });

    it('ignores ytInitialPlayerResponse when videoId does not match', async () => {
      (window as unknown as Record<string, unknown>).ytInitialPlayerResponse = {
        videoDetails: {
          title: 'Wrong Video Title',
          videoId: 'wrong123',
        },
      };
      setWatchFlexyVideoId('new123');
      setDomTitle('Correct DOM Title');

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Correct DOM Title',
        videoUrl: window.location.href,
      });
    });

    it('falls back to meta[name=title] when no other sources available', async () => {
      setWatchFlexyVideoId('new123');
      const meta = document.createElement('meta');
      meta.name = 'title';
      meta.content = 'Meta Title Tag';
      document.head.appendChild(meta);

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Meta Title Tag',
        videoUrl: window.location.href,
      });

      document.head.removeChild(meta);
    });

    it('falls back to og:title when meta[name=title] not available', async () => {
      setWatchFlexyVideoId('new123');
      const ogMeta = document.createElement('meta');
      ogMeta.setAttribute('property', 'og:title');
      ogMeta.content = 'Open Graph Title';
      document.head.appendChild(ogMeta);

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Open Graph Title',
        videoUrl: window.location.href,
      });

      document.head.removeChild(ogMeta);
    });

    it('falls back to document.title as last resort', async () => {
      setWatchFlexyVideoId('new123');
      document.title = 'Video Title - YouTube';

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Video Title',
        videoUrl: window.location.href,
      });
    });

    it('returns Unknown when document.title is just YouTube', async () => {
      setWatchFlexyVideoId('new123');
      document.title = 'YouTube';

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Unknown',
        videoUrl: window.location.href,
      });
    });
  });

  describe('video ID detection', () => {
    it('uses meta[itemprop=videoId] when ytd-watch-flexy not present', async () => {
      const meta = document.createElement('meta');
      meta.setAttribute('itemprop', 'videoId');
      meta.content = 'new123';
      document.body.appendChild(meta);
      setDomTitle('Meta Video ID Title');

      const result = await extractVideoInfoInPage('new123');

      expect(result).toEqual({
        type: 'VIDEO_INFO_SUCCESS',
        videoId: 'new123',
        videoTitle: 'Meta Video ID Title',
        videoUrl: window.location.href,
      });
    });
  });

  it('prefers player video data when DOM video id is stale', async () => {
    setWatchFlexyVideoId('old456');
    setDomTitle('Old DOM Title');
    setPlayerVideoData('new123', 'Player Title');

    const result = await extractVideoInfoInPage('new123');

    expect(result).toEqual({
      type: 'VIDEO_INFO_SUCCESS',
      videoId: 'new123',
      videoTitle: 'Player Title',
      videoUrl: window.location.href,
    });
  });

  it('does not use stale DOM title when page video id mismatches and no player data', async () => {
    setWatchFlexyVideoId('old456');
    setDomTitle('Old DOM Title');

    const result = await extractVideoInfoInPage('new123');

    expect(result).toEqual({
      type: 'VIDEO_INFO_SUCCESS',
      videoId: 'new123',
      videoTitle: 'Unknown',
      videoUrl: window.location.href,
    });
  });

  it('uses DOM title once page video id matches', async () => {
    setWatchFlexyVideoId('new123');
    setDomTitle('Current DOM Title');

    const result = await extractVideoInfoInPage('new123');

    expect(result).toEqual({
      type: 'VIDEO_INFO_SUCCESS',
      videoId: 'new123',
      videoTitle: 'Current DOM Title',
      videoUrl: window.location.href,
    });
  });

  it('waits for the page to update before reading DOM title', async () => {
    vi.useFakeTimers();
    setWatchFlexyVideoId('old456');
    setDomTitle('Old DOM Title');

    setTimeout(() => {
      const flexy = document.querySelector('ytd-watch-flexy');
      flexy?.setAttribute('video-id', 'new123');
      const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
      if (titleElement) {
        titleElement.textContent = 'Fresh DOM Title';
      }
    }, 200);

    const resultPromise = extractVideoInfoInPage('new123');
    vi.advanceTimersByTime(2000);
    const result = await resultPromise;

    expect(result).toEqual({
      type: 'VIDEO_INFO_SUCCESS',
      videoId: 'new123',
      videoTitle: 'Fresh DOM Title',
      videoUrl: window.location.href,
    });
  });
});
