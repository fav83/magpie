import type { TranscriptResponse, RequestMessage } from '../types/messages';
import type { PlayerResponse, CaptionTrack } from '../types/transcript';
import {
  parseTranscriptXml,
  parseTranscriptJson,
} from '../utils/transcriptParser';
import { setUrlParam, buildUnsignedCaptionUrl } from '../utils/urlHelpers';
import { extractJsonObject } from '../utils/jsonExtractor';
import { log, logError } from '../utils/logger';

// Constants for retry logic
const FETCH_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_PLAYER_RESPONSE_ATTEMPTS = 10;
const PLAYER_RESPONSE_RETRY_DELAY_MS = 300;

chrome.runtime.onMessage.addListener(
  (
    message: RequestMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: TranscriptResponse | { type: 'PONG' }) => void
  ) => {
    // Handle ping to check if content script is loaded
    if (message.type === 'PING') {
      sendResponse({ type: 'PONG' });
      return false;
    }

    if (message.type !== 'GET_TRANSCRIPT') {
      return false;
    }
    extractTranscript(message.videoId)
      .then(sendResponse)
      .catch(() => {
        sendResponse({ type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' });
      });
    return true; // Keep channel open for async response
  }
);

async function extractTranscript(videoId?: string): Promise<TranscriptResponse> {
  try {
    log('Starting transcript extraction');

    // Wait for player response with retries (handles SPA navigation timing)
    const playerResponse = await waitForPlayerResponse(videoId);
    if (!playerResponse) {
      log('No player response found after retries');
      return { type: 'TRANSCRIPT_ERROR', error: 'VIDEO_NOT_FOUND' };
    }

    const videoTitle = playerResponse.videoDetails?.title ?? 'Unknown';
    log('Video title:', videoTitle);

    // Get caption tracks
    const captionTracks =
      playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    log('Caption tracks:', captionTracks?.length ?? 0);

    if (!captionTracks || captionTracks.length === 0) {
      log('No caption tracks found');
      return { type: 'TRANSCRIPT_ERROR', error: 'NO_CAPTIONS' };
    }

    // Select best caption track with smart fallback:
    // 1. English manual captions
    // 2. English auto-generated
    // 3. Video's default language
    // 4. Browser locale
    // 5. First available track
    const defaultLang = playerResponse.videoDetails?.defaultAudioLanguage;
    const browserLang = navigator.language.split('-')[0] ?? 'en'; // e.g., 'en-US' -> 'en'

    const findTrack = (lang: string, excludeAsr = false) =>
      captionTracks.find(
        (t: CaptionTrack) =>
          t.languageCode === lang && (!excludeAsr || t.kind !== 'asr')
      );

    const track =
      findTrack('en', true) ?? // English manual
      findTrack('en') ?? // English auto-generated
      (defaultLang && findTrack(defaultLang, true)) ?? // Video's language manual
      (defaultLang && findTrack(defaultLang)) ?? // Video's language auto-generated
      (browserLang !== 'en' && findTrack(browserLang, true)) ?? // Browser locale manual
      (browserLang !== 'en' && findTrack(browserLang)) ?? // Browser locale auto-generated
      captionTracks[0]; // Fallback to first available

    if (!track) {
      return { type: 'TRANSCRIPT_ERROR', error: 'NO_CAPTIONS' };
    }

    log('Using caption track:', track.languageCode);
    log('Full baseUrl:', track.baseUrl);

    const transcript = await fetchTranscript(track, videoId);
    if (!transcript) {
      log('Transcript is empty after all attempts');
      return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
    }

    return { type: 'TRANSCRIPT_SUCCESS', transcript, videoTitle };
  } catch (error) {
    logError('Extraction error:', error);
    return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
  }
}

/**
 * Wait for player response to be available, with retries for SPA navigation timing
 */
async function waitForPlayerResponse(videoId?: string): Promise<PlayerResponse | null> {
  for (let attempt = 1; attempt <= MAX_PLAYER_RESPONSE_ATTEMPTS; attempt++) {
    const playerResponse = getPlayerResponse();

    if (playerResponse) {
      // If we have a videoId, verify it matches
      if (videoId && playerResponse.videoDetails?.videoId !== videoId) {
        log(`Player response video ID mismatch (attempt ${attempt}/${MAX_PLAYER_RESPONSE_ATTEMPTS})`);
      } else {
        log(`Got player response on attempt ${attempt}`);
        return playerResponse;
      }
    } else {
      log(`No player response yet (attempt ${attempt}/${MAX_PLAYER_RESPONSE_ATTEMPTS})`);
    }

    if (attempt < MAX_PLAYER_RESPONSE_ATTEMPTS) {
      await sleep(PLAYER_RESPONSE_RETRY_DELAY_MS);
    }
  }

  return null;
}

async function fetchTranscript(
  track: CaptionTrack,
  videoId?: string
): Promise<string> {
  const xml = await fetchTranscriptBody(track.baseUrl, 'primary');
  if (xml) {
    const transcript = parseTranscriptXml(xml);
    if (transcript) {
      return transcript;
    }
  }

  const jsonUrl = setUrlParam(track.baseUrl, 'fmt', 'json3');
  log('Falling back to json3 captions');
  const jsonBody = await fetchTranscriptBody(jsonUrl, 'json3');
  const jsonTranscript = parseTranscriptJson(jsonBody);
  if (jsonTranscript) {
    return jsonTranscript;
  }

  if (!videoId) {
    return '';
  }

  const fallbackUrl = buildUnsignedCaptionUrl(videoId, track.languageCode, track.kind);
  log('Falling back to unsigned captions URL');
  const fallbackBody = await fetchTranscriptBody(fallbackUrl, 'unsigned-json3');
  return parseTranscriptJson(fallbackBody);
}

/**
 * Fetch transcript body with timeout and retry logic
 */
async function fetchTranscriptBody(url: string, label: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log(`Fetching (${label}), attempt ${attempt}/${MAX_RETRIES}:`, url);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        log(`Response (${label}):`, response.status, response.statusText);

        // Retry on server errors (5xx)
        if (response.status >= 500) {
          logError(`Server error ${response.status}, will retry`);
          lastError = new Error(`Server error: ${response.status}`);
          if (attempt < MAX_RETRIES) {
            await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
            continue;
          }
          return '';
        }

        if (!response.ok) {
          logError('Failed to fetch captions:', response.status);
          return '';
        }

        const body = await response.text();
        log(`Body length (${label}):`, body.length);
        return body;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it was a timeout
      if (lastError.name === 'AbortError') {
        logError(`Fetch timeout (${label}), attempt ${attempt}/${MAX_RETRIES}`);
      } else {
        logError(`Fetch error (${label}), attempt ${attempt}/${MAX_RETRIES}:`, error);
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  logError(`All ${MAX_RETRIES} fetch attempts failed for ${label}:`, lastError);
  return '';
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getPlayerResponse(): PlayerResponse | null {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent;
    if (!content) continue;
    if (content.includes('ytInitialPlayerResponse')) {
      const startMarker = 'ytInitialPlayerResponse';
      const startIndex = content.indexOf(startMarker);
      if (startIndex === -1) continue;

      // Find the opening brace
      const jsonStart = content.indexOf('{', startIndex);
      if (jsonStart === -1) continue;

      // Find matching closing brace using brace counting
      const jsonString = extractJsonObject(content, jsonStart);
      if (jsonString) {
        try {
          return JSON.parse(jsonString) as PlayerResponse;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
