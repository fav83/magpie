/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/unbound-method, @typescript-eslint/no-unnecessary-type-assertion */
// This file interacts with YouTube's internal untyped APIs which require any types

import type { TranscriptResponse } from '../types/messages';

/**
 * Extracts transcript from a YouTube video page.
 * This function runs in the page's MAIN world context via chrome.scripting.executeScript,
 * which gives it access to YouTube's internal player APIs and session data.
 *
 * All helper functions are defined inline because they need to exist in the page context.
 *
 * ## File Organization (Table of Contents)
 *
 * 1. CONSTANTS - Timeout and retry configuration
 * 2. LOGGING UTILITIES - Console logging with prefix
 * 3. HELPER UTILITIES - Sleep, cached DOM queries
 * 4. YOUTUBE PAGE DATA EXTRACTION - Get player response and initial data
 * 5. JSON/XML PARSING UTILITIES - Parse transcript formats
 * 6. OBJECT TRAVERSAL & TRANSCRIPT SEGMENT EXTRACTION - Walk YouTube's nested objects
 * 7. NETWORK REQUEST CAPTURE & PO TOKEN HANDLING - Intercept timedtext URLs
 * 8. DOM-BASED TRANSCRIPT EXTRACTION - Extract from YouTube's DOM
 * 9. YOUTUBE API-BASED TRANSCRIPT FETCHING - Fetch via YouTubei/timedtext APIs
 * 10. MAIN EXTRACTION LOGIC - Orchestrates extraction with fallback priorities
 */
export async function extractTranscriptInPage(videoId: string, debugMode = false): Promise<TranscriptResponse> {
  // ============================================================================
  // CONSTANTS
  // ============================================================================
  const FETCH_TIMEOUT_MS = 10000; // 10 seconds
  const MAX_FETCH_RETRIES = 3;
  const INITIAL_RETRY_DELAY_MS = 500;
  let ccClickAttempted = false;

  // ============================================================================
  // LOGGING UTILITIES
  // ============================================================================
  const logPrefix = '[YT-Summarizer][main]';

  // Only log in debug mode (development builds)
  const logMain = (...args: unknown[]) => {
    if (debugMode) console.log(logPrefix, ...args);
  };
  const logMainError = (...args: unknown[]) => {
    if (debugMode) console.error(logPrefix, ...args);
  };
  const logMainWarn = (...args: unknown[]) => {
    if (debugMode) console.warn(logPrefix, ...args);
  };

  // Performance instrumentation - only in debug mode
  const logPerf = (message: string, durationMs?: number) => {
    if (!debugMode) return;
    if (durationMs !== undefined) {
      console.log(`${logPrefix}[PERF] ${message}: ${durationMs.toFixed(2)}ms`);
    } else {
      console.log(`${logPrefix}[PERF] ${message}`);
    }
  };

  // Helper to track operation timing
  const startTimer = (operation: string): () => void => {
    if (!debugMode) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op in production
      return () => {};
    }
    const startTime = performance.now();
    console.log(`${logPrefix}[PERF] START: ${operation}`);
    return () => {
      const duration = performance.now() - startTime;
      console.log(`${logPrefix}[PERF] END: ${operation}: ${duration.toFixed(2)}ms`);
    };
  };

  // ============================================================================
  // FREEZE DIAGNOSTIC UTILITIES
  // Helps identify what's happening when page freezes during ad playback
  // Only enabled in debug mode
  // ============================================================================
  const logFreezeDiag = (context: string, data: Record<string, unknown>) => {
    if (!debugMode) return;
    console.log(`${logPrefix}[FREEZE-DIAG][${context}]`, {
      timestamp: new Date().toISOString(),
      ...data,
    });
  };

  // Check if an ad is currently playing
  const checkAdState = (): { isAdPlaying: boolean; adDetails: Record<string, unknown> } => {
    const player = document.getElementById('movie_player') as any;

    let playerState = 'unknown';
    let playerAdState = false;
    try {
      // Primary method: use YouTube's player API (most reliable)
      if (player?.getAdState) {
        const adState = player.getAdState();
        // adState: 0 = no ad, 1 = ad playing, 2 = ad paused
        playerAdState = adState === 1 || adState === 2;
      }
      if (player?.getPlayerState) {
        const states: Record<number, string> = { '-1': 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };
        playerState = states[player.getPlayerState()] ?? `state:${player.getPlayerState()}`;
      }
    } catch {
      // Player access failed
    }

    // Secondary method: DOM-based detection (fallback, but more specific)
    // Only check elements that are VISIBLE, not just present in DOM
    const adOverlay = document.querySelector('.ytp-ad-player-overlay');
    const adBadge = document.querySelector('.ytp-ad-text, .ytp-ad-badge');
    const skipButton = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern');
    const adShowingClass = !!player?.classList?.contains('ad-showing') ||
      !!player?.classList?.contains('ad-interrupting');

    // Check if elements are actually visible (not hidden)
    const isVisible = (el: Element | null): boolean => {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const adOverlayVisible = isVisible(adOverlay);
    const adBadgeVisible = isVisible(adBadge);
    const skipButtonVisible = isVisible(skipButton);

    // Ad is playing if player API says so, OR if ad-specific visible elements exist
    // Note: We prioritize playerAdState as it's more reliable
    const isAdPlaying = playerAdState || adOverlayVisible || adBadgeVisible || skipButtonVisible || adShowingClass;

    return {
      isAdPlaying,
      adDetails: {
        playerAdState,
        playerState,
        adOverlayVisible,
        adBadgeVisible,
        skipButtonVisible,
        adShowingClass,
      },
    };
  };

  // Log current page/player state for freeze diagnosis (always enabled)
  const logPageState = (context: string) => {
    const { isAdPlaying, adDetails } = checkAdState();
    const player = document.getElementById('movie_player');
    const videoElement = document.querySelector('video');

    logFreezeDiag(context, {
      isAdPlaying,
      ...adDetails,
      playerExists: !!player,
      videoCurrentTime: videoElement?.currentTime ?? 'N/A',
      videoPaused: videoElement?.paused ?? 'N/A',
      documentReadyState: document.readyState,
      visibilityState: document.visibilityState,
      domMutationsActive: 'check MutationObserver logs',
    });
  };

  /**
   * Wait for ad to finish playing before proceeding with extraction.
   * Uses polling with exponential backoff to avoid blocking the main thread.
   * Returns true if ad finished, false if timed out.
   */
  const waitForAdToFinish = async (maxWaitMs = 60000): Promise<boolean> => {
    const { isAdPlaying } = checkAdState();
    if (!isAdPlaying) {
      return true; // No ad playing, proceed immediately
    }

    logFreezeDiag('waitForAdToFinish-start', { maxWaitMs });
    const startTime = performance.now();
    let checkInterval = 500; // Start with 500ms checks
    const maxInterval = 2000; // Cap at 2 second checks

    while (performance.now() - startTime < maxWaitMs) {
      await sleep(checkInterval);

      const { isAdPlaying: stillPlaying, adDetails } = checkAdState();
      const elapsed = performance.now() - startTime;

      if (!stillPlaying) {
        logFreezeDiag('waitForAdToFinish-done', {
          durationMs: elapsed.toFixed(2),
          result: 'ad finished',
        });
        // Give YouTube a moment to load the actual video's data
        await sleep(500);
        return true;
      }

      // Log progress every ~5 seconds
      if (Math.floor(elapsed / 5000) > Math.floor((elapsed - checkInterval) / 5000)) {
        logFreezeDiag('waitForAdToFinish-waiting', {
          elapsedMs: elapsed.toFixed(2),
          ...adDetails,
        });
      }

      // Increase interval gradually (exponential backoff capped at maxInterval)
      checkInterval = Math.min(checkInterval * 1.5, maxInterval);
    }

    logFreezeDiag('waitForAdToFinish-timeout', {
      durationMs: (performance.now() - startTime).toFixed(2),
    });
    return false;
  };

  // ============================================================================
  // HELPER UTILITIES
  // ============================================================================
  const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

  // Query script elements fresh each time to avoid stale data after SPA navigation
  // (YouTube updates script content during navigation, so caching is unsafe)
  function getScripts(): NodeListOf<HTMLScriptElement> {
    return document.querySelectorAll('script');
  }

  // ============================================================================
  // YOUTUBE PAGE DATA EXTRACTION
  // Functions to extract player response and initial data from YouTube's page
  // ============================================================================
  function getPlayerResponse(): any | null {
    const endTimer = startTimer('getPlayerResponse');

    const parsePlayerResponse = (value: unknown): any | null => {
      if (!value) {
        return null;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      if (typeof value === 'object') {
        return value;
      }
      return null;
    };

    // Helper to validate player response has the correct video ID
    const validateVideoId = (response: any): boolean => {
      const responseVideoId = response?.videoDetails?.videoId;
      if (!responseVideoId) {
        return true; // Can't validate, assume it's ok
      }
      if (responseVideoId !== videoId) {
        logMain('Player response has stale video ID:', responseVideoId, 'expected:', videoId);
        return false;
      }
      return true;
    };

    const returnWith = (result: any | null, source: string) => {
      if (result) {
        logMain('getPlayerResponse: Found via', source);
      }
      endTimer();
      return result;
    };

    // Try the movie_player element first - it should have current video data
    logMain('getPlayerResponse: Trying movie_player element');
    const player = document.getElementById('movie_player') as any;
    if (player?.getPlayerResponse) {
      try {
        const playerResponse = player.getPlayerResponse();
        if (playerResponse && validateVideoId(playerResponse)) {
          return returnWith(playerResponse, 'movie_player element');
        }
      } catch (e) {
        logMain('getPlayerResponse: movie_player.getPlayerResponse() failed:', e);
      }
    }

    // Try ytplayer.config.args (sometimes more current than ytInitialPlayerResponse)
    logMain('getPlayerResponse: Trying ytplayer.config');
    const ytplayerConfig = (window as any).ytplayer?.config;
    const ytplayerArgs = ytplayerConfig?.args;
    const ytplayerResponse = parsePlayerResponse(
      ytplayerArgs?.player_response ?? ytplayerArgs?.raw_player_response
    );
    if (ytplayerResponse && validateVideoId(ytplayerResponse)) {
      return returnWith(ytplayerResponse, 'ytplayer.config');
    }

    // Try ytcfg sources
    logMain('getPlayerResponse: Trying ytcfg sources');
    const ytcfg = (window as any).ytcfg;
    if (ytcfg?.get) {
      const cfgResponse = parsePlayerResponse(ytcfg.get('PLAYER_RESPONSE'));
      if (cfgResponse && validateVideoId(cfgResponse)) {
        return returnWith(cfgResponse, 'ytcfg PLAYER_RESPONSE');
      }

      const playerConfig = ytcfg.get('PLAYER_CONFIG');
      const playerArgs = playerConfig?.args ?? playerConfig?.PLAYER_CONFIG?.args;
      const playerConfigResponse = parsePlayerResponse(
        playerArgs?.player_response ?? playerArgs?.raw_player_response
      );
      if (playerConfigResponse && validateVideoId(playerConfigResponse)) {
        return returnWith(playerConfigResponse, 'ytcfg PLAYER_CONFIG');
      }

      const playerVars = ytcfg.get('PLAYER_VARS');
      const playerVarsResponse = parsePlayerResponse(
        playerVars?.player_response ?? playerVars?.raw_player_response
      );
      if (playerVarsResponse && validateVideoId(playerVarsResponse)) {
        return returnWith(playerVarsResponse, 'ytcfg PLAYER_VARS');
      }
    }

    // Try ytInitialPlayerResponse (may be stale after SPA navigation)
    logMain('getPlayerResponse: Trying window.ytInitialPlayerResponse');
    const globalResponse = (window as any).ytInitialPlayerResponse;
    if (globalResponse && typeof globalResponse === 'object' && validateVideoId(globalResponse)) {
      return returnWith(globalResponse, 'window.ytInitialPlayerResponse');
    }

    // Last resort: try parsing from script tags (use cached query)
    logMain('getPlayerResponse: Trying script tags (last resort)');
    const scripts = getScripts();
    const scriptCount = scripts.length;
    logMain(`getPlayerResponse: Found ${scriptCount} script tags to search`);

    let scriptsSearched = 0;
    for (const script of scripts) {
      const content = script.textContent;
      if (!content?.includes('ytInitialPlayerResponse')) {
        continue;
      }

      scriptsSearched++;
      logMain(`getPlayerResponse: Searching script tag ${scriptsSearched} (${(content.length / 1024).toFixed(1)}KB)`);

      const startMarker = 'ytInitialPlayerResponse';
      const startIndex = content.indexOf(startMarker);
      if (startIndex === -1) {
        continue;
      }

      const jsonStart = content.indexOf('{', startIndex);
      if (jsonStart === -1) {
        continue;
      }

      const jsonString = extractJsonObject(content, jsonStart);
      if (jsonString) {
        try {
          const parsed = JSON.parse(jsonString);
          if (validateVideoId(parsed)) {
            return returnWith(parsed, `script tag #${scriptsSearched}`);
          }
        } catch {
          // Continue to next script
        }
      }
    }

    logMain('getPlayerResponse: No valid player response found for video:', videoId);
    endTimer();
    return null;
  }

  function getInitialData(): any | null {
    const globalData = (window as any).ytInitialData;
    if (globalData && typeof globalData === 'object') {
      return globalData;
    }

    // Use cached script query
    const scripts = getScripts();
    for (const script of scripts) {
      const content = script.textContent;
      if (!content?.includes('ytInitialData')) {
        continue;
      }

      const startMarker = 'ytInitialData';
      const startIndex = content.indexOf(startMarker);
      if (startIndex === -1) {
        continue;
      }

      const jsonStart = content.indexOf('{', startIndex);
      if (jsonStart === -1) {
        continue;
      }

      const jsonString = extractJsonObject(content, jsonStart);
      if (jsonString) {
        try {
          return JSON.parse(jsonString);
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  // ============================================================================
  // JSON/XML PARSING UTILITIES
  // Parse transcript data from various formats (XML, JSON)
  // ============================================================================
  function extractJsonObject(content: string, startIndex: number): string | null {
    const contentLength = content.length;
    const searchLength = contentLength - startIndex;

    // Log warning for large content that might cause freezes
    if (searchLength > 500000) {
      logMainWarn(`extractJsonObject: Parsing large content (${(searchLength / 1024).toFixed(1)}KB from index ${startIndex})`);
    }

    const endTimer = startTimer(`extractJsonObject (${(searchLength / 1024).toFixed(1)}KB)`);

    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let iterationCount = 0;
    const maxIterations = 10000000; // Safety limit to prevent infinite loops

    for (let i = startIndex; i < contentLength; i++) {
      iterationCount++;

      // Safety check to prevent browser freeze
      if (iterationCount > maxIterations) {
        logMainError(`extractJsonObject: Hit iteration limit (${maxIterations}), aborting to prevent freeze`);
        endTimer();
        return null;
      }

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
          const result = content.slice(startIndex, i + 1);
          if (debugMode) {
            logPerf(`extractJsonObject: Extracted ${(result.length / 1024).toFixed(1)}KB JSON after ${iterationCount} iterations`);
          }
          endTimer();
          return result;
        }
      }
    }

    logMain(`extractJsonObject: No complete JSON object found after ${iterationCount} iterations`);
    endTimer();
    return null;
  }

  function decodeHtmlEntities(text: string): string {
    // Use regex-based decoding to avoid TrustedHTML CSP issues in YouTube's page context
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Format seconds into [MM:SS] or [H:MM:SS] timestamp
   */
  function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `[${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
    }
    return `[${minutes}:${secs.toString().padStart(2, '0')}]`;
  }

  function parseTranscriptXml(xml: string): string {
    if (!xml) {
      return '';
    }

    // Use regex-based parsing to avoid TrustedHTML CSP issues in YouTube's page context
    // Match <text ...>content</text> elements with start attribute
    const textPattern = /<text[^>]*\sstart="([^"]*)"[^>]*>([^<]*)<\/text>/g;
    const segments: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = textPattern.exec(xml)) !== null) {
      const startTime = parseFloat(match[1] ?? '0');
      const text = match[2];
      if (text) {
        const decodedText = decodeHtmlEntities(text).trim();
        if (decodedText) {
          segments.push(`${formatTimestamp(startTime)} ${decodedText}`);
        }
      }
    }

    if (segments.length === 0) {
      return '';
    }

    return segments.join('\n');
  }

  function parseTranscriptJson(jsonText: string): string {
    if (!jsonText) {
      return '';
    }

    try {
      const data = JSON.parse(jsonText) as {
        events?: {
          tStartMs?: number;
          segs?: { utf8?: string }[];
        }[];
      };

      const segments: string[] = [];
      for (const event of data.events ?? []) {
        const segmentText = (event.segs ?? [])
          .map((segment) => segment.utf8 ?? '')
          .join('')
          .trim();
        if (segmentText) {
          const startSeconds = (event.tStartMs ?? 0) / 1000;
          segments.push(`${formatTimestamp(startSeconds)} ${segmentText}`);
        }
      }

      return segments.join('\n');
    } catch {
      return '';
    }
  }

  // ============================================================================
  // OBJECT TRAVERSAL & TRANSCRIPT SEGMENT EXTRACTION
  // Walk YouTube's nested data structures to find transcript content
  // ============================================================================

  /** Max depth for object traversal to prevent freezes on huge YouTube objects */
  const WALK_MAX_DEPTH = 15;

  // Track walkObject call count for perf logging
  let walkObjectCallCount = 0;

  /**
   * Iteratively traverse an object graph with depth limiting and early termination.
   * @param value - The root object to traverse
   * @param visitor - Called for each object node. Return true to stop traversal early.
   * @param maxDepth - Maximum depth to traverse (default: 15)
   */
  function walkObject(
    value: unknown,
    visitor: (node: unknown) => boolean | undefined,
    maxDepth: number = WALK_MAX_DEPTH
  ): void {
    const startTime = performance.now();
    walkObjectCallCount++;
    const callId = walkObjectCallCount;

    const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
    const seen = new Set<unknown>();
    let nodesVisited = 0;
    let maxDepthReached = 0;
    const MAX_NODES = 100000; // Safety limit to prevent freezes

    let current = stack.pop();
    while (current) {
      const { node, depth } = current;

      // Track max depth reached for debugging
      if (depth > maxDepthReached) {
        maxDepthReached = depth;
      }

      // Skip if exceeds max depth
      if (depth > maxDepth) {
        continue;
      }

      if (!node || typeof node !== 'object') {
        continue;
      }

      if (seen.has(node)) {
        continue;
      }
      seen.add(node);
      nodesVisited++;

      // Safety check to prevent browser freeze
      if (nodesVisited > MAX_NODES) {
        const duration = performance.now() - startTime;
        logMainWarn(`walkObject #${callId}: Hit node limit (${MAX_NODES}), aborting. Duration: ${duration.toFixed(2)}ms, maxDepth reached: ${maxDepthReached}`);
        return;
      }

      // Allow early termination if visitor returns true
      if (visitor(node) === true) {
        const duration = performance.now() - startTime;
        logPerf(`walkObject #${callId} (early exit) visited ${nodesVisited} nodes, maxDepth: ${maxDepthReached}`, duration);
        return;
      }

      const nextDepth = depth + 1;
      if (Array.isArray(node)) {
        for (const item of node) {
          stack.push({ node: item, depth: nextDepth });
        }
      } else {
        for (const key of Object.keys(node)) {
          stack.push({ node: (node as Record<string, unknown>)[key], depth: nextDepth });
        }
      }
      current = stack.pop();
    }

    const duration = performance.now() - startTime;
    logPerf(`walkObject #${callId} visited ${nodesVisited} nodes, maxDepth: ${maxDepthReached}`, duration);
  }

  /**
   * Find the first value in an object graph that matches a selector.
   * Simplifies the common pattern of walkObject with early return.
   * @param value - The root object to traverse
   * @param selector - Called for each node. Return the value to find, or undefined to continue.
   * @param maxDepth - Maximum depth to traverse (default: 15)
   */
  function findInObject<T>(
    value: unknown,
    selector: (node: any) => T | undefined,
    maxDepth: number = WALK_MAX_DEPTH
  ): T | undefined {
    let result: T | undefined;
    walkObject(value, (node) => {
      const found = selector(node);
      if (found !== undefined) {
        result = found;
        return true; // Stop traversal
      }
      return undefined;
    }, maxDepth);
    return result;
  }

  function extractSnippetText(snippet: any): string {
    if (typeof snippet?.simpleText === 'string') {
      return snippet.simpleText;
    }

    if (Array.isArray(snippet?.runs)) {
      return snippet.runs.map((run: any) => run?.text ?? '').join('');
    }

    return '';
  }

  function extractTranscriptSegments(data: any, skipIfAdPlaying = false): string {
    if (!data) {
      return '';
    }

    // Skip expensive traversal during ad playback - transcript won't be there anyway
    if (skipIfAdPlaying) {
      const { isAdPlaying } = checkAdState();
      if (isAdPlaying) {
        logFreezeDiag('extractTranscriptSegments-ad-skip', {
          reason: 'ad playing, skipping expensive traversal',
        });
        return '';
      }
    }

    const startTime = performance.now();
    logFreezeDiag('extractTranscriptSegments-start', {
      dataType: typeof data,
      isArray: Array.isArray(data),
    });

    const segments: string[] = [];
    walkObject(data, (node: any) => {
      const renderer = node?.transcriptSegmentRenderer ?? node?.transcriptCueRenderer;
      if (!renderer?.snippet) {
        return undefined; // Continue traversal
      }
      const text = extractSnippetText(renderer.snippet);
      if (text) {
        segments.push(text);
      }
      return undefined; // Continue traversal
    });

    const result = segments.join(' ').replaceAll(/\s+/g, ' ').trim();
    logFreezeDiag('extractTranscriptSegments-done', {
      durationMs: (performance.now() - startTime).toFixed(2),
      segmentsFound: segments.length,
      resultLength: result.length,
    });

    return result;
  }

  function findTranscriptPanel(data: any): any | null {
    if (!data) {
      return null;
    }

    return findInObject(data, (node) => {
      const renderer = node?.engagementPanelSectionListRenderer;
      if (!renderer) {
        return undefined;
      }

      const targetId = renderer.targetId ?? renderer.panelIdentifier;
      if (typeof targetId === 'string' && targetId.includes('transcript')) {
        return renderer;
      }
      return undefined;
    }) ?? null;
  }

  function findTranscriptParams(data: any): string {
    const extractParams = (node: any): string | undefined => {
      const directEndpoint = node?.getTranscriptEndpoint;
      const nestedEndpoint = node?.continuationEndpoint?.getTranscriptEndpoint;
      const endpointParams = directEndpoint?.params ?? nestedEndpoint?.params;
      const rendererParams = node?.transcriptRenderer?.params;
      const candidate = endpointParams ?? rendererParams;
      return typeof candidate === 'string' ? candidate : undefined;
    };

    // Try panel first, then full data
    const panel = findTranscriptPanel(data);
    if (panel) {
      const params = findInObject(panel, extractParams);
      if (params) return params;
    }

    return findInObject(data, extractParams) ?? '';
  }

  function findTranscriptContinuation(data: any): string {
    const extractContinuation = (node: any): string | undefined => {
      const listRenderer = node?.transcriptSegmentListRenderer;
      const continuations = listRenderer?.continuations;
      const nextData = continuations?.[0]?.nextContinuationData;
      const candidate =
        nextData?.continuation ?? continuations?.[0]?.continuationCommand?.token;
      return typeof candidate === 'string' ? candidate : undefined;
    };

    // Try panel first, then full data
    const panel = findTranscriptPanel(data);
    if (panel) {
      const continuation = findInObject(panel, extractContinuation);
      if (continuation) return continuation;
    }

    return findInObject(data, extractContinuation) ?? '';
  }

  // ============================================================================
  // NETWORK REQUEST CAPTURE & PO TOKEN HANDLING
  // Intercept YouTube's network requests to capture timedtext URLs and PO tokens
  // ============================================================================
  function getYtcfgValue<T>(key: string): T | null {
    const ytcfg = (window as any).ytcfg;
    if (ytcfg && typeof ytcfg.get === 'function') {
      return ytcfg.get(key) as T;
    }
    return null;
  }

  function getCaptureStore(): {
    installed?: boolean;
    pot?: string;
    clientName?: string;
    timedtextUrl?: string;
    videoId?: string;
  } {
    const win = window as any;
    if (!win.__ytSummarizerCapture) {
      win.__ytSummarizerCapture = {};
    }
    return win.__ytSummarizerCapture;
  }

  function extractUrlParam(url: string, param: string): string {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.searchParams.get(param) ?? '';
    } catch {
      return '';
    }
  }

  function extractPotFromUrl(url: string): string {
    return extractUrlParam(url, 'pot');
  }

  function extractClientNameFromUrl(url: string): string {
    return extractUrlParam(url, 'c');
  }

  /**
   * Extract video ID from a URL's 'v' query parameter.
   *
   * NOTE: This is a MAIN world duplicate of extractVideoId() in utils/youtube.ts.
   * Duplicated here because MAIN world scripts cannot import modules.
   * If you modify this logic, also update the shared utils version.
   */
  function extractVideoIdFromUrl(url: string): string {
    return extractUrlParam(url, 'v');
  }

  function findPoTokenInObject(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    // Check direct path first
    const direct = data.serviceIntegrityDimensions?.poToken;
    if (typeof direct === 'string') {
      return direct;
    }

    return findInObject(data, (node) => {
      const candidate = node?.serviceIntegrityDimensions?.poToken;
      return typeof candidate === 'string' ? candidate : undefined;
    }) ?? '';
  }

  function findClientNameInObject(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    // Check direct path first
    const direct = data?.context?.client?.clientName;
    if (typeof direct === 'string') {
      return direct;
    }

    return findInObject(data, (node) => {
      const candidate = node?.client?.clientName;
      return typeof candidate === 'string' ? candidate : undefined;
    }) ?? '';
  }

  function parseParamValue(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
    return value;
  }

  function parseUrlEncoded(text: string): Record<string, unknown> | null {
    try {
      const params = new URLSearchParams(text);
      if (!Array.from(params.keys()).length) {
        return null;
      }
      const parsed: Record<string, unknown> = {};
      for (const [key, value] of params.entries()) {
        parsed[key] = parseParamValue(value);
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function parseRequestBody(body: unknown): any | null {
    if (!body) {
      return null;
    }

    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (!trimmed) {
        return null;
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return parseUrlEncoded(trimmed);
        }
      }
      return parseUrlEncoded(trimmed);
    }

    if (body instanceof URLSearchParams) {
      return parseUrlEncoded(body.toString());
    }

    if (body instanceof FormData) {
      const parsed: Record<string, unknown> = {};
      for (const [key, value] of body.entries()) {
        parsed[key] = typeof value === 'string' ? parseParamValue(value) : value;
      }
      return parsed;
    }

    if (body instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder('utf-8').decode(new Uint8Array(body));
        return parseRequestBody(text);
      } catch {
        return null;
      }
    }

    if (ArrayBuffer.isView(body)) {
      try {
        const view = body as ArrayBufferView;
        const text = new TextDecoder('utf-8').decode(
          new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
        );
        return parseRequestBody(text);
      } catch {
        return null;
      }
    }

    return null;
  }

  function maybeCaptureRequest(url: string, body?: unknown): void {
    const capture = getCaptureStore();

    if (body instanceof Blob) {
      body
        .text()
        .then((text) => { maybeCaptureRequest(url, text); })
        .catch(() => undefined);
      return;
    }

    if (url.includes('/api/timedtext')) {
      const newVideoId = extractVideoIdFromUrl(url);

      // If video ID changed, clear old capture data
      if (newVideoId && capture.videoId && newVideoId !== capture.videoId) {
        logMain('Video changed, clearing old capture data');
        delete capture.timedtextUrl;
        delete capture.pot;
      }

      // Always update timedtext URL (latest is for current video)
      capture.timedtextUrl = url;
      if (newVideoId) {
        capture.videoId = newVideoId;
      }
      logMain('Captured timedtext URL for video:', newVideoId);

      const pot = extractPotFromUrl(url);
      if (pot) {
        capture.pot = pot;
        logMain('Captured PO token from timedtext URL');
      }

      const clientName = extractClientNameFromUrl(url);
      if (clientName) {
        capture.clientName = clientName;
      }

      return;
    }

    if (!url.includes('/youtubei/v1/player')) {
      return;
    }

    const parsedBody = parseRequestBody(body);
    if (!parsedBody) {
      return;
    }

    const pot = findPoTokenInObject(parsedBody);
    if (pot && !capture.pot) {
      capture.pot = pot;
      logMain('Captured PO token from player request');
    }

    const clientName = findClientNameInObject(parsedBody);
    if (clientName && !capture.clientName) {
      capture.clientName = clientName;
    }
  }

  function installNetworkCapture(): void {
    const capture = getCaptureStore();
    if (capture.installed) {
      return;
    }
    capture.installed = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> => {
      try {
        const input = args[0];
        const init = args[1];
        let url = '';
        const body = init?.body;

        if (typeof input === 'string') {
          url = input;
        } else if (input && typeof input === 'object' && 'url' in input) {
          url = (input).url;
          if (!body && input instanceof Request) {
            input
              .clone()
              .text()
              .then((text) => { maybeCaptureRequest(url, text); })
              .catch(() => undefined);
          }
        }

        if (url) {
          maybeCaptureRequest(url, body);
        }
      } catch {
        // Ignore capture errors
      }

      return originalFetch(...args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { __ytSummarizerUrl?: string },
      method: string,
      url: string,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ): void {
      this.__ytSummarizerUrl = url;
      originalOpen.call(this, method, url, async ?? true, username, password);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { __ytSummarizerUrl?: string },
      body?: Document | XMLHttpRequestBodyInit | null
    ): void {
      try {
        if (this.__ytSummarizerUrl) {
          maybeCaptureRequest(this.__ytSummarizerUrl, body ?? undefined);
        }
      } catch {
        // Ignore capture errors
      }

      originalSend.call(this, body ?? null);
    };
  }

  function requiresPoToken(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      const exp = parsed.searchParams.get('exp') ?? '';
      const parts = exp.split(',');
      return parts.includes('xpe') || parts.includes('xpv');
    } catch {
      return url.includes('exp=xpe') || url.includes('exp=xpv');
    }
  }

  function applyPoTokenParams(
    url: string,
    pot: string,
    clientName?: string
  ): string {
    if (!pot) {
      return url;
    }

    let updated = setUrlParam(url, 'pot', pot);
    updated = setUrlParam(updated, 'potc', '1');
    if (clientName) {
      updated = setUrlParam(updated, 'c', clientName);
    }
    return updated;
  }

  async function waitForCapture<T>(
    getter: () => T | undefined,
    timeoutMs: number
  ): Promise<T | undefined> {
    const start = Date.now();
    return await new Promise((resolve) => {
      const check = () => {
        const value = getter();
        if (value) {
          resolve(value);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(undefined);
          return;
        }
        setTimeout(check, 200);
      };
      check();
    });
  }

  // ============================================================================
  // DOM-BASED TRANSCRIPT EXTRACTION
  // Extract transcripts from YouTube's DOM when API methods fail
  // ============================================================================
  function parseTranscriptPayload(body: string): string {
    if (!body) {
      return '';
    }

    // Try JSON first (more common from captured URLs)
    const jsonTranscript = parseTranscriptJson(body);
    if (jsonTranscript) {
      return jsonTranscript;
    }

    // Fall back to XML parsing
    return parseTranscriptXml(body);
  }

  function collectTranscriptSegmentsFromDom(): string {
    const nodes = Array.from(
      document.querySelectorAll(
        'ytd-transcript-segment-renderer #segment-text, ytd-transcript-segment-renderer .segment-text, ytd-transcript-segment-renderer yt-formatted-string'
      )
    );
    const segments = nodes
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean);
    return segments.join(' ').replaceAll(/\s+/g, ' ').trim();
  }

  async function triggerSubtitleLoading(
    options: { allowClick?: boolean; reason?: string } = {}
  ): Promise<string | null> {
    const startTime = performance.now();
    const capture = getCaptureStore();
    const allowClick = options.allowClick !== false;
    const getCcButton = () =>
      document.querySelector('.ytp-subtitles-button') as HTMLElement | null;

    logFreezeDiag('triggerSubtitleLoading-start', {
      captureVideoId: capture.videoId,
      expectedVideoId: videoId,
      hasTimedtextUrl: !!capture.timedtextUrl,
      allowClick,
      reason: options.reason,
    });

    // If we already have a timedtext URL for the current video, return it
    if (capture.timedtextUrl && capture.videoId === videoId) {
      logMain('Already have captured timedtext URL for current video');
      logFreezeDiag('triggerSubtitleLoading-already-captured', {
        durationMs: (performance.now() - startTime).toFixed(2),
      });
      return capture.timedtextUrl;
    }

    // Clear stale data if video ID doesn't match
    if (capture.timedtextUrl && capture.videoId !== videoId) {
      logMain('Clearing stale timedtext URL (was for video:', capture.videoId, ')');
      delete capture.timedtextUrl;
      delete capture.videoId;
      delete capture.pot;
    }

    // Check if an ad is playing - if so, skip the slow CC button fallback
    // because captions are not available during ads
    const { isAdPlaying, adDetails } = checkAdState();
    if (isAdPlaying) {
      logMain('Ad is playing, skipping CC button fallback (captions unavailable during ads)');
      logFreezeDiag('triggerSubtitleLoading-ad-playing-skip', {
        durationMs: (performance.now() - startTime).toFixed(2),
        ...adDetails,
      });
      return null;
    }

    // Check CC button state EARLY
    let ccButton = getCcButton();
    const ariaLabel = ccButton?.getAttribute('aria-label') ?? '';
    const ccSaysUnavailable = ariaLabel.toLowerCase().includes('unavailable');

    if (ccSaysUnavailable) {
      logMain('CC button says unavailable - will skip natural wait but still try clicking');
      logMain('  (ASR captions may need activation via CC click)');
      logFreezeDiag('triggerSubtitleLoading-cc-unavailable-will-try-click', {
        durationMs: (performance.now() - startTime).toFixed(2),
        ariaLabel,
      });
    }

    // First, wait a bit to see if YouTube naturally captures the timedtext URL
    // (happens during page load or when video plays)
    // SKIP this wait if CC says unavailable - natural capture won't happen
    let capturedUrl: string | undefined;

    if (!ccSaysUnavailable) {
      // Only wait for natural capture if CC button doesn't say unavailable
      logMain('Waiting for natural timedtext capture...');
      logFreezeDiag('triggerSubtitleLoading-natural-wait-start', {
        elapsedMs: (performance.now() - startTime).toFixed(2),
      });
      const naturalWaitStart = performance.now();
      capturedUrl = await waitForCapture(() => {
        const store = getCaptureStore();
        if (store.timedtextUrl && store.videoId === videoId) {
          return store.timedtextUrl;
        }
        return undefined;
      }, 1500);
      logFreezeDiag('triggerSubtitleLoading-natural-wait-done', {
        durationMs: (performance.now() - naturalWaitStart).toFixed(2),
        success: !!capturedUrl,
      });

      if (capturedUrl) {
        logMain('Got timedtext URL from natural capture');
        logFreezeDiag('triggerSubtitleLoading-natural-success', {
          totalDurationMs: (performance.now() - startTime).toFixed(2),
        });
        return capturedUrl;
      }

      // Re-check ad state before clicking CC button (ad may have started during wait)
      const adStateAfterWait = checkAdState();
      if (adStateAfterWait.isAdPlaying) {
        logMain('Ad started during wait, skipping CC button click');
        logFreezeDiag('triggerSubtitleLoading-ad-started-during-wait', {
          durationMs: (performance.now() - startTime).toFixed(2),
          ...adStateAfterWait.adDetails,
        });
        return null;
      }
    } else {
      logMain('Skipping natural wait (CC says unavailable), proceeding directly to CC click');
    }

    // Re-check CC button (might not exist or state may have changed)
    ccButton = getCcButton();
    if (!ccButton) {
      logMain('CC button not found on player, waiting briefly for controls');
      const waitedButton = await waitForCapture(() => getCcButton() ?? undefined, 1500);
      ccButton = waitedButton ?? null;
    }

    if (!ccButton) {
      logMain('CC button not found on player');
      logFreezeDiag('triggerSubtitleLoading-no-cc-button', {
        durationMs: (performance.now() - startTime).toFixed(2),
      });
      return null;
    }

    if (!allowClick) {
      logMain('CC click disabled for this attempt; skipping click');
      logFreezeDiag('triggerSubtitleLoading-cc-click-skipped', {
        durationMs: (performance.now() - startTime).toFixed(2),
        reason: options.reason ?? 'unspecified',
      });
      return null;
    }

    if (ccClickAttempted) {
      logMain('CC click already attempted for this extraction; skipping');
      logFreezeDiag('triggerSubtitleLoading-cc-click-already-attempted', {
        durationMs: (performance.now() - startTime).toFixed(2),
      });
      return null;
    }

    // IMPORTANT: Before clicking CC, make sure the player is actually showing our video
    // During SPA navigation, clicking CC too early can load captions for a different video
    const player = document.getElementById('movie_player') as any;
    const playerCurrentVideoId = player?.getVideoData?.()?.video_id;

    if (playerCurrentVideoId && playerCurrentVideoId !== videoId) {
      logMain('Player showing different video, waiting for correct video...');
      logMain(`  Player videoId: ${playerCurrentVideoId}, Expected: ${videoId}`);
      logFreezeDiag('triggerSubtitleLoading-wrong-video-waiting', {
        durationMs: (performance.now() - startTime).toFixed(2),
        playerVideoId: playerCurrentVideoId,
        expectedVideoId: videoId,
      });

      // Wait for player to load the correct video (up to 5 seconds)
      const maxWaitForVideo = 5000;
      const videoWaitStart = performance.now();
      let playerReady = false;

      while (performance.now() - videoWaitStart < maxWaitForVideo) {
        await sleep(200);
        const currentPlayerId = player?.getVideoData?.()?.video_id;
        if (currentPlayerId === videoId) {
          logMain('Player now showing correct video');
          logFreezeDiag('triggerSubtitleLoading-correct-video-loaded', {
            waitDurationMs: (performance.now() - videoWaitStart).toFixed(2),
          });
          playerReady = true;
          break;
        }
      }

      if (!playerReady) {
        logMain('Timeout waiting for player to load correct video');
        logFreezeDiag('triggerSubtitleLoading-video-wait-timeout', {
          durationMs: (performance.now() - startTime).toFixed(2),
          playerVideoId: player?.getVideoData?.()?.video_id,
          expectedVideoId: videoId,
        });
        return null;
      }
    }

    // Check current state - we want to turn captions ON to trigger the request
    const isPressed = ccButton.getAttribute('aria-pressed') === 'true';
    const currentAriaLabel = ccButton.getAttribute('aria-label') ?? '';
    const currentlyUnavailable = currentAriaLabel.toLowerCase().includes('unavailable');

    logMain('CC button state:', isPressed ? 'on' : 'off', 'aria-label:', currentAriaLabel);

    // Log if unavailable state changed (was available before, now unavailable)
    if (currentlyUnavailable && !ccSaysUnavailable) {
      logMain('CC button became unavailable during wait');
      logFreezeDiag('triggerSubtitleLoading-cc-became-unavailable', {
        durationMs: (performance.now() - startTime).toFixed(2),
        ariaLabel: currentAriaLabel,
      });
    }

    // Note: We try clicking even if CC says "unavailable" because ASR captions
    // may need activation via click
    logMain('Clicking CC button to trigger subtitle load');
    logFreezeDiag('triggerSubtitleLoading-cc-click', {
      elapsedMs: (performance.now() - startTime).toFixed(2),
      isPressed,
      currentAriaLabel,
      isUnavailable: currentlyUnavailable,
    });

    // Click once to toggle (will trigger timedtext fetch)
    ccClickAttempted = true;
    ccButton.click();

    // Log state immediately after click
    await sleep(100); // Brief pause to let YouTube process the click
    const postClickLabel = ccButton.getAttribute('aria-label') ?? '';
    const postClickPressed = ccButton.getAttribute('aria-pressed') ?? '';
    logMain('CC button state AFTER click:', {
      ariaLabel: postClickLabel,
      ariaPressed: postClickPressed,
      changedFromUnavailable: currentAriaLabel.toLowerCase().includes('unavailable') &&
                              !postClickLabel.toLowerCase().includes('unavailable'),
    });
    logFreezeDiag('triggerSubtitleLoading-post-click-state', {
      preClickLabel: currentAriaLabel,
      postClickLabel,
      preClickPressed: isPressed,
      postClickPressed,
    });

    // Wait for timedtext URL to be captured for the current video
    const ccWaitStart = performance.now();
    capturedUrl = await waitForCapture(() => {
      const store = getCaptureStore();
      // Only return URL if it's for the current video
      if (store.timedtextUrl && store.videoId === videoId) {
        return store.timedtextUrl;
      }
      return undefined;
    }, 3000); // Increased timeout
    logFreezeDiag('triggerSubtitleLoading-cc-wait-done', {
      durationMs: (performance.now() - ccWaitStart).toFixed(2),
      success: !!capturedUrl,
    });

    // Restore original state if we turned captions on
    if (!isPressed && capturedUrl) {
      // Turn them back off after a short delay
      setTimeout(() => { ccButton.click(); }, 500);
    }

    if (capturedUrl) {
      logMain('Captured timedtext URL after CC button click');
      logFreezeDiag('triggerSubtitleLoading-cc-success', {
        totalDurationMs: (performance.now() - startTime).toFixed(2),
      });
    } else {
      logMain('No timedtext URL captured after CC button click');
      logFreezeDiag('triggerSubtitleLoading-cc-failed', {
        totalDurationMs: (performance.now() - startTime).toFixed(2),
      });
    }

    return capturedUrl ?? null;
  }

  async function fetchFromCapturedTimedtextUrl(
    options?: { allowClick?: boolean; reason?: string }
  ): Promise<string> {
    const startTime = performance.now();
    logFreezeDiag('fetchFromCapturedTimedtextUrl-start', {});

    const capturedUrl = await triggerSubtitleLoading(options);
    logFreezeDiag('fetchFromCapturedTimedtextUrl-trigger-done', {
      durationMs: (performance.now() - startTime).toFixed(2),
      hasCapturedUrl: !!capturedUrl,
    });

    if (!capturedUrl) {
      logFreezeDiag('fetchFromCapturedTimedtextUrl-no-url', {
        totalDurationMs: (performance.now() - startTime).toFixed(2),
      });
      return '';
    }

    logMain('Fetching from captured timedtext URL:', capturedUrl.substring(0, 100) + '...');

    try {
      const fetchStart = performance.now();
      const response = await fetch(capturedUrl, {
        credentials: 'include',
        cache: 'no-store',
      });

      logMain('Captured URL response:', response.status, 'Content-Length:', response.headers.get('content-length'));
      logFreezeDiag('fetchFromCapturedTimedtextUrl-fetch-done', {
        durationMs: (performance.now() - fetchStart).toFixed(2),
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        logFreezeDiag('fetchFromCapturedTimedtextUrl-fetch-failed', {
          totalDurationMs: (performance.now() - startTime).toFixed(2),
          status: response.status,
        });
        return '';
      }

      const body = await response.text();
      logMain('Captured URL body length:', body.length);

      if (!body) {
        logFreezeDiag('fetchFromCapturedTimedtextUrl-empty-body', {
          totalDurationMs: (performance.now() - startTime).toFixed(2),
        });
        return '';
      }

      // Parse as XML or JSON
      const parseStart = performance.now();
      const transcript = parseTranscriptPayload(body);
      logFreezeDiag('fetchFromCapturedTimedtextUrl-parse-done', {
        parseDurationMs: (performance.now() - parseStart).toFixed(2),
        totalDurationMs: (performance.now() - startTime).toFixed(2),
        transcriptLength: transcript.length,
      });
      return transcript;
    } catch (error) {
      logMainError('Error fetching from captured URL:', error);
      logFreezeDiag('fetchFromCapturedTimedtextUrl-error', {
        totalDurationMs: (performance.now() - startTime).toFixed(2),
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  function findTranscriptMenuItem(): HTMLElement | null {
    const menuItems = Array.from(
      document.querySelectorAll<HTMLElement>('ytd-menu-service-item-renderer')
    );

    for (const item of menuItems) {
      const data =
        (item as any)?.data ??
        (item as any)?.__data?.data ??
        (item as any)?.__data;

      const endpoint =
        data?.serviceEndpoint?.getTranscriptEndpoint ??
        data?.serviceEndpoint?.getTranscriptEndpoint?.params;

      if (endpoint) {
        return item;
      }

      const text = item.textContent?.toLowerCase() ?? '';
      if (text.includes('transcript')) {
        return item;
      }
    }

    return null;
  }

  /** Max mutations before giving up to prevent freeze on busy DOMs */
  const MAX_MUTATIONS = 500;

  async function waitForTranscriptMenuItem(
    timeoutMs: number
  ): Promise<HTMLElement | null> {
    const endTimer = startTimer(`waitForTranscriptMenuItem (timeout: ${timeoutMs}ms)`);

    // Check ad state before starting MutationObserver
    logPageState('waitForTranscriptMenuItem-start');

    const existing = findTranscriptMenuItem();
    if (existing) {
      logMain('waitForTranscriptMenuItem: Found existing menu item');
      endTimer();
      return existing;
    }

    return new Promise((resolve) => {
      let mutationCount = 0;
      let lastMutationLogTime = performance.now();
      const startTime = performance.now();
      const MUTATION_LOG_INTERVAL = 100; // Log every 100 mutations or 500ms

      const observer = new MutationObserver((mutations) => {
        mutationCount++;
        const now = performance.now();

        // Detailed logging for freeze diagnosis
        if (mutationCount % MUTATION_LOG_INTERVAL === 0 || now - lastMutationLogTime > 500) {
          const { isAdPlaying } = checkAdState();
          logFreezeDiag('waitForTranscriptMenuItem-mutations', {
            mutationCount,
            elapsedMs: (now - startTime).toFixed(2),
            mutationsInBatch: mutations.length,
            addedNodes: mutations.reduce((sum, m) => sum + m.addedNodes.length, 0),
            removedNodes: mutations.reduce((sum, m) => sum + m.removedNodes.length, 0),
            isAdPlaying,
          });
          lastMutationLogTime = now;
        }

        // Bail out if too many mutations (busy DOM)
        if (mutationCount > MAX_MUTATIONS) {
          const duration = performance.now() - startTime;
          logMainWarn(`waitForTranscriptMenuItem: Hit mutation limit (${MAX_MUTATIONS}) after ${duration.toFixed(2)}ms`);
          logPageState('waitForTranscriptMenuItem-mutation-limit');
          observer.disconnect();
          endTimer();
          resolve(null);
          return;
        }

        const item = findTranscriptMenuItem();
        if (item) {
          const duration = performance.now() - startTime;
          logMain(`waitForTranscriptMenuItem: Found after ${mutationCount} mutations, ${duration.toFixed(2)}ms`);
          observer.disconnect();
          endTimer();
          resolve(item);
        }
      });

      // Try to scope to menu container, fall back to document
      const menuContainer = document.querySelector('ytd-popup-container, ytd-menu-popup-renderer, tp-yt-iron-dropdown');
      const observeTarget = menuContainer ?? document.documentElement;
      logMain('waitForTranscriptMenuItem: Observing', menuContainer ? 'menu container' : 'document');
      logFreezeDiag('waitForTranscriptMenuItem-observer-setup', {
        observingDocument: !menuContainer,
        observeTargetTagName: observeTarget.tagName,
      });

      observer.observe(observeTarget, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        logMain(`waitForTranscriptMenuItem: Timeout after ${mutationCount} mutations`);
        logPageState('waitForTranscriptMenuItem-timeout');
        observer.disconnect();
        endTimer();
        resolve(null);
      }, timeoutMs);
    });
  }

  async function waitForTranscriptSegments(
    timeoutMs: number
  ): Promise<string> {
    const endTimer = startTimer(`waitForTranscriptSegments (timeout: ${timeoutMs}ms)`);

    // Check ad state before starting MutationObserver
    logPageState('waitForTranscriptSegments-start');

    const existing = collectTranscriptSegmentsFromDom();
    if (existing) {
      logMain(`waitForTranscriptSegments: Found existing segments (${existing.length} chars)`);
      endTimer();
      return existing;
    }

    return new Promise((resolve) => {
      let mutationCount = 0;
      let lastMutationLogTime = performance.now();
      const startTime = performance.now();
      const MUTATION_LOG_INTERVAL = 100; // Log every 100 mutations or 500ms

      const observer = new MutationObserver((mutations) => {
        mutationCount++;
        const now = performance.now();

        // Detailed logging for freeze diagnosis
        if (mutationCount % MUTATION_LOG_INTERVAL === 0 || now - lastMutationLogTime > 500) {
          const { isAdPlaying } = checkAdState();
          logFreezeDiag('waitForTranscriptSegments-mutations', {
            mutationCount,
            elapsedMs: (now - startTime).toFixed(2),
            mutationsInBatch: mutations.length,
            addedNodes: mutations.reduce((sum, m) => sum + m.addedNodes.length, 0),
            removedNodes: mutations.reduce((sum, m) => sum + m.removedNodes.length, 0),
            isAdPlaying,
          });
          lastMutationLogTime = now;
        }

        // Bail out if too many mutations (busy DOM)
        if (mutationCount > MAX_MUTATIONS) {
          const duration = performance.now() - startTime;
          logMainWarn(`waitForTranscriptSegments: Hit mutation limit (${MAX_MUTATIONS}) after ${duration.toFixed(2)}ms`);
          logPageState('waitForTranscriptSegments-mutation-limit');
          observer.disconnect();
          const result = collectTranscriptSegmentsFromDom();
          logMain(`waitForTranscriptSegments: Returning ${result.length} chars after mutation limit`);
          endTimer();
          resolve(result);
          return;
        }

        const transcript = collectTranscriptSegmentsFromDom();
        if (transcript) {
          const duration = performance.now() - startTime;
          logMain(`waitForTranscriptSegments: Found ${transcript.length} chars after ${mutationCount} mutations, ${duration.toFixed(2)}ms`);
          observer.disconnect();
          endTimer();
          resolve(transcript);
        }
      });

      // Try to scope to transcript panel container, fall back to document
      const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript"], ytd-transcript-renderer');
      const observeTarget = transcriptPanel ?? document.documentElement;
      logMain('waitForTranscriptSegments: Observing', transcriptPanel ? 'transcript panel' : 'document');
      logFreezeDiag('waitForTranscriptSegments-observer-setup', {
        observingDocument: !transcriptPanel,
        observeTargetTagName: observeTarget.tagName,
      });

      observer.observe(observeTarget, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        logMain(`waitForTranscriptSegments: Timeout after ${mutationCount} mutations`);
        logPageState('waitForTranscriptSegments-timeout');
        observer.disconnect();
        const result = collectTranscriptSegmentsFromDom();
        logMain(`waitForTranscriptSegments: Returning ${result.length} chars after timeout`);
        endTimer();
        resolve(result);
      }, timeoutMs);
    });
  }

  async function openTranscriptPanel(): Promise<boolean> {
    const menuButton = document.querySelector<HTMLElement>(
      'ytd-video-primary-info-renderer ytd-menu-renderer yt-icon-button button, ytd-video-primary-info-renderer ytd-menu-renderer button'
    );

    if (!menuButton) {
      logMain('Transcript menu button not found');
      return false;
    }

    menuButton.click();

    const menuItem = await waitForTranscriptMenuItem(2000);
    if (!menuItem) {
      logMain('Transcript menu item not found');
      return false;
    }

    menuItem.click();
    return true;
  }

  async function extractTranscriptFromDom(skipIfAdPlaying = false): Promise<string> {
    // Skip DOM manipulation during ad playback - transcript panel won't be available anyway
    if (skipIfAdPlaying) {
      const { isAdPlaying } = checkAdState();
      if (isAdPlaying) {
        logFreezeDiag('extractTranscriptFromDom-ad-skip', {
          reason: 'ad playing, skipping DOM extraction',
        });
        return '';
      }
    }

    const existing = collectTranscriptSegmentsFromDom();
    if (existing) {
      return existing;
    }

    const opened = await openTranscriptPanel();
    if (!opened) {
      return '';
    }

    return await waitForTranscriptSegments(4000);
  }

  // ============================================================================
  // YOUTUBE API-BASED TRANSCRIPT FETCHING
  // Fetch transcripts via YouTube's internal APIs (YouTubei, timedtext)
  // ============================================================================

  /**
   * Fetch fresh player response directly from YouTube's player API.
   * Used as fallback when page's playerResponse is stale after SPA navigation.
   */
  async function fetchFreshPlayerResponse(targetVideoId: string): Promise<any | null> {
    try {
      const pageContext = getYtcfgValue<any>('INNERTUBE_CONTEXT');
      const apiKey = getYtcfgValue<string>('INNERTUBE_API_KEY') ?? 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

      if (!pageContext) {
        logMain('Cannot fetch fresh player response: missing page context');
        return null;
      }

      // Clone and enhance context
      const requestContext = JSON.parse(JSON.stringify(pageContext));
      const visitorData = getYtcfgValue<string>('VISITOR_DATA');
      if (visitorData && requestContext?.client) {
        requestContext.client.visitorData = visitorData;
      }

      const clientVersion = getYtcfgValue<string>('INNERTUBE_CONTEXT_CLIENT_VERSION') ?? '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clientVersion) {
        headers['X-Youtube-Client-Version'] = clientVersion;
        headers['X-Youtube-Client-Name'] = '1';
      }
      if (visitorData) {
        headers['X-Goog-Visitor-Id'] = visitorData;
      }

      logMain('Fetching fresh player response for video:', targetVideoId);

      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            context: requestContext,
            videoId: targetVideoId,
            playbackContext: {
              contentPlaybackContext: {
                signatureTimestamp: getYtcfgValue<number>('STS') ?? 0,
              },
            },
          }),
        }
      );

      if (!response.ok) {
        logMain('Fresh player response fetch failed:', response.status);
        return null;
      }

      const data = await response.json();

      // Validate response has the right video ID
      if (data?.videoDetails?.videoId === targetVideoId) {
        logMain('Got fresh player response for video:', targetVideoId);
        return data;
      }

      logMain('Fresh player response video ID mismatch:', data?.videoDetails?.videoId);
      return null;
    } catch (error) {
      logMainError('Error fetching fresh player response:', error);
      return null;
    }
  }

  async function fetchTranscriptFromYoutubei(initialData: any, skipIfAdPlaying = false): Promise<string> {
    try {
      if (!initialData) {
        logMain('Missing initial data for YouTubei transcript');
        return '';
      }

      // Skip expensive operations during ad playback - transcript API won't work anyway
      if (skipIfAdPlaying) {
        const { isAdPlaying } = checkAdState();
        if (isAdPlaying) {
          logFreezeDiag('fetchTranscriptFromYoutubei-ad-skip', {
            reason: 'ad playing, skipping expensive operations',
          });
          return '';
        }
      }

      const startTime = performance.now();
      logFreezeDiag('fetchTranscriptFromYoutubei-start', {});

      const params = findTranscriptParams(initialData);
      const continuation = params ? '' : findTranscriptContinuation(initialData);
      logFreezeDiag('fetchTranscriptFromYoutubei-params-found', {
        durationMs: (performance.now() - startTime).toFixed(2),
        hasParams: !!params,
        hasContinuation: !!continuation,
      });

      if (!params && !continuation) {
        logMain('No transcript params or continuation found');
        return '';
      }

      logMain(
        'Transcript params length:',
        params.length,
        'continuation length:',
        continuation.length
      );

      // Use the page's actual context - params are tied to the session that generated them
      const pageContext = getYtcfgValue<any>('INNERTUBE_CONTEXT');
      const apiKey = getYtcfgValue<string>('INNERTUBE_API_KEY') ?? 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

      if (!pageContext) {
        logMain('Missing page context');
        return '';
      }

      // Clone context and ensure visitorData is set
      const requestContext = JSON.parse(JSON.stringify(pageContext));
      const visitorData = getYtcfgValue<string>('VISITOR_DATA');
      if (visitorData && requestContext?.client) {
        requestContext.client.visitorData = visitorData;
      }

      const clientVersion = getYtcfgValue<string>('INNERTUBE_CONTEXT_CLIENT_VERSION') ?? '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clientVersion) {
        headers['X-Youtube-Client-Version'] = clientVersion;
        headers['X-Youtube-Client-Name'] = '1';
      }
      if (visitorData) {
        headers['X-Goog-Visitor-Id'] = visitorData;
      }

      logMain('Using page context for get_transcript, apiKey:', apiKey.substring(0, 10) + '...');

      // Try with params first, then continuation format if that fails
      let response = await fetch(
        `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            context: requestContext,
            params: params || undefined,
            continuation: continuation || undefined,
          }),
        }
      );

      // If params failed, try with videoId directly (alternative approach)
      if (!response.ok && params) {
        logMain('Params failed, trying alternative format');
        response = await fetch(
          `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`,
          {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              context: requestContext,
              continuation: params, // Try params as continuation
            }),
          }
        );
      }

      logMain(
        'YouTubei transcript response:',
        response.status,
        response.statusText
      );

      if (!response.ok) {
        const errorBody = await response.text();
        logMain('YouTubei transcript error body:', errorBody.substring(0, 500));
        return '';
      }

      const data = await response.json();
      return extractTranscriptSegments(data);
    } catch (error) {
      logMainError('YouTubei transcript fetch failed', error);
      return '';
    }
  }

  function setUrlParam(url: string, key: string, value: string): string {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set(key, value);
      return parsedUrl.toString();
    } catch {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}${key}=${value}`;
    }
  }

  function buildUnsignedUrl(
    id: string,
    languageCode: string,
    kind?: string
  ): string {
    const url = new URL('https://www.youtube.com/api/timedtext');
    url.searchParams.set('v', id);
    url.searchParams.set('lang', languageCode);
    if (kind) {
      url.searchParams.set('kind', kind);
    }
    url.searchParams.set('fmt', 'json3');
    return url.toString();
  }

  async function fetchTranscriptBody(url: string, label: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
      try {
        logMain(`Fetching (${label}), attempt ${attempt}/${MAX_FETCH_RETRIES}:`, url);

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

          logMain(`Response (${label}):`, response.status, response.statusText);

          // Retry on server errors (5xx)
          if (response.status >= 500) {
            logMainError(`Server error ${response.status}, will retry`);
            lastError = new Error(`Server error: ${response.status}`);
            if (attempt < MAX_FETCH_RETRIES) {
              await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
              continue;
            }
            return '';
          }

          if (!response.ok) {
            logMainError('Failed to fetch captions:', response.status);
            return '';
          }

          const body = await response.text();
          logMain(`Body length (${label}):`, body.length);
          return body;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it was a timeout
        if (lastError.name === 'AbortError') {
          logMainError(`Fetch timeout (${label}), attempt ${attempt}/${MAX_FETCH_RETRIES}`);
        } else {
          logMainError(`Fetch error (${label}), attempt ${attempt}/${MAX_FETCH_RETRIES}:`, error);
        }

        // Retry with exponential backoff
        if (attempt < MAX_FETCH_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          logMain(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    logMainError(`All ${MAX_FETCH_RETRIES} fetch attempts failed for ${label}:`, lastError);
    return '';
  }

  async function fetchTranscript(track: any, id: string): Promise<string> {
    const potRequired = requiresPoToken(track.baseUrl);
    logMain('PO token required:', potRequired);

    // First, check if we have captured data for THIS video
    // Wait for capture store to have the correct video's data
    logMain('Waiting for capture store to have data for video:', id);
    const correctCaptureData = await waitForCapture(() => {
      const store = getCaptureStore();
      if (store.videoId === id && store.timedtextUrl) {
        return store;
      }
      return undefined;
    }, 2000);

    if (correctCaptureData?.timedtextUrl) {
      logMain('Found captured timedtext URL for current video, trying it first');
      const capturedBody = await fetchTranscriptBody(correctCaptureData.timedtextUrl, 'captured-for-video');
      const capturedTranscript = parseTranscriptPayload(capturedBody);
      if (capturedTranscript) {
        logMain('Got transcript from captured URL');
        return capturedTranscript;
      }
      logMain('Captured URL returned empty, trying track baseUrl');
    }

    const capture = getCaptureStore();
    // Only use PO token if it's for the current video
    const pot = (capture.videoId === id) ? capture.pot : undefined;
    const clientName =
      capture.clientName ||
      getYtcfgValue<any>('INNERTUBE_CONTEXT')?.client?.clientName;

    if (potRequired) {
      logMain('Timedtext PO token available for current video:', Boolean(pot));
    }

    const primaryUrl =
      potRequired && pot
        ? applyPoTokenParams(track.baseUrl, pot, clientName)
        : track.baseUrl;
    const xmlBody = await fetchTranscriptBody(primaryUrl, 'primary');
    const xmlTranscript = parseTranscriptXml(xmlBody);
    if (xmlTranscript) {
      return xmlTranscript;
    }

    // Try waiting for captured URL again (might have been captured during the fetch)
    if (potRequired) {
      const capturedTimedtextUrl = await waitForCapture(() => {
        const store = getCaptureStore();
        // Only use if it's for the current video
        if (store.videoId === id && store.timedtextUrl) {
          return store.timedtextUrl;
        }
        return undefined;
      }, 1500);

      if (capturedTimedtextUrl && capturedTimedtextUrl !== primaryUrl) {
        logMain('Found newly captured timedtext URL, trying it');
        const capturedBody = await fetchTranscriptBody(
          capturedTimedtextUrl,
          'captured-timedtext'
        );
        const capturedTranscript = parseTranscriptPayload(capturedBody);
        if (capturedTranscript) {
          return capturedTranscript;
        }
      }
    }

    logMain('Falling back to json3 captions');
    const jsonBaseUrl = setUrlParam(track.baseUrl, 'fmt', 'json3');
    const jsonUrl =
      potRequired && pot
        ? applyPoTokenParams(jsonBaseUrl, pot, clientName)
        : jsonBaseUrl;
    const jsonBody = await fetchTranscriptBody(jsonUrl, 'json3');
    const jsonTranscript = parseTranscriptJson(jsonBody);
    if (jsonTranscript) {
      return jsonTranscript;
    }

    if (!id) {
      return '';
    }

    logMain('Falling back to unsigned captions URL');
    const fallbackBaseUrl = buildUnsignedUrl(id, track.languageCode, track.kind);
    const fallbackUrl =
      potRequired && pot
        ? applyPoTokenParams(fallbackBaseUrl, pot, clientName)
        : fallbackBaseUrl;
    const fallbackBody = await fetchTranscriptBody(fallbackUrl, 'unsigned-json3');
    return parseTranscriptJson(fallbackBody);
  }

  /**
   * Extract caption tracks from player response, checking multiple possible locations.
   */
  function extractCaptionTracks(playerResp: any): any[] {
    if (!playerResp) {
      return [];
    }

    // Primary location
    const primary = playerResp.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(primary) && primary.length > 0) {
      return primary;
    }

    // Alternative location: directly under captions
    const altCaptions = playerResp.captions?.captionTracks;
    if (Array.isArray(altCaptions) && altCaptions.length > 0) {
      return altCaptions;
    }

    // Check inside streamingData for caption references
    const streamingCaptions = playerResp.streamingData?.captionTracks;
    if (Array.isArray(streamingCaptions) && streamingCaptions.length > 0) {
      return streamingCaptions;
    }

    return [];
  }

  function getVideoTitleFromDom(): string {
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    const flexyVideoId = watchFlexy?.getAttribute('video-id');
    const metaVideoId = document.querySelector('meta[itemprop="videoId"]')?.getAttribute('content');
    const pageVideoId = flexyVideoId ?? metaVideoId ?? null;
    if (pageVideoId && pageVideoId !== videoId) {
      return 'Unknown';
    }

    try {
      const player = document.getElementById('movie_player') as unknown as {
        getVideoData?: () => { title?: string; video_id?: string };
      } | null;
      const videoData = player?.getVideoData?.();
      if (videoData?.title && videoData.video_id === videoId) {
        return videoData.title;
      }
    } catch {
      // Ignore player access errors
    }

    // Try to get title from various DOM sources
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string');
    if (titleElement?.textContent) {
      return titleElement.textContent.trim();
    }

    const titleMeta = document.querySelector('meta[name="title"]');
    if (titleMeta?.getAttribute('content')) {
      return titleMeta.getAttribute('content') ?? 'Unknown';
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.getAttribute('content')) {
      return ogTitle.getAttribute('content') ?? 'Unknown';
    }

    return document.title.replace(' - YouTube', '').trim() || 'Unknown';
  }

  // Wait for YouTube to finish loading the new video after SPA navigation
  async function waitForVideoReady(): Promise<{ playerResponse: any; capture: any }> {
    const endTimer = startTimer('waitForVideoReady');
    const maxAttempts = 25; // Increased from 15 for slower connections
    const delayMs = 300; // Increased from 200ms

    logMain(`waitForVideoReady: Starting for video ${videoId}, maxAttempts=${maxAttempts}, delay=${delayMs}ms`);

    // Log initial ad state - this is critical for freeze diagnosis
    logPageState('waitForVideoReady-start');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const capture = getCaptureStore();
      const playerResponse = getPlayerResponse();

      // Log ad state periodically during waiting
      if (attempt % 5 === 0) {
        const { isAdPlaying } = checkAdState();
        logFreezeDiag('waitForVideoReady-polling', {
          attempt: attempt + 1,
          maxAttempts,
          isAdPlaying,
          captureVideoId: capture.videoId,
          hasTimedtextUrl: !!capture.timedtextUrl,
          playerVideoId: playerResponse?.videoDetails?.videoId,
        });
      }

      // Check if capture has the right video
      if (capture.timedtextUrl && capture.videoId === videoId) {
        logMain(`waitForVideoReady: Capture store ready (attempt ${attempt + 1}/${maxAttempts})`);
        logPageState('waitForVideoReady-capture-ready');
        endTimer();
        return { playerResponse, capture };
      }

      // Check if player response has the right video
      if (playerResponse?.videoDetails?.videoId === videoId) {
        logMain(`waitForVideoReady: Player response ready (attempt ${attempt + 1}/${maxAttempts})`);
        logPageState('waitForVideoReady-player-ready');
        endTimer();
        return { playerResponse, capture };
      }

      if (attempt < maxAttempts - 1) {
        if (debugMode) {
          logMain(`waitForVideoReady: Attempt ${attempt + 1}/${maxAttempts} - captureVideoId=${capture.videoId}, hasTimedtext=${!!capture.timedtextUrl}, playerVideoId=${playerResponse?.videoDetails?.videoId}`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Return whatever we have after timeout
    logMainWarn(`waitForVideoReady: Timeout after ${maxAttempts} attempts, returning current state`);
    logPageState('waitForVideoReady-timeout');
    endTimer();
    return { playerResponse: getPlayerResponse(), capture: getCaptureStore() };
  }

  // ============================================================================
  // MAIN EXTRACTION LOGIC
  // Orchestrates the transcript extraction with fallback priorities:
  // 1. Pre-captured timedtext URL (from network interception)
  // 2. CC button trigger (captures fresh timedtext URL)
  // 3. Direct timedtext API fetch
  // 4. YouTubei get_transcript API
  // 5. DOM transcript panel extraction
  // ============================================================================
  const totalExtractionTimer = startTimer(`TOTAL EXTRACTION for video ${videoId}`);
  const extractionStartTime = performance.now();

  try {
    logMain('='.repeat(60));
    logMain('Starting transcript extraction for video:', videoId);
    logMain('Page URL:', window.location.href);
    logMain('User Agent:', navigator.userAgent);
    logMain('Timestamp:', new Date().toISOString());
    logMain('='.repeat(60));

    logFreezeDiag('extraction-start', { videoId });
    logPageState('extraction-start');

    const networkCaptureStart = performance.now();
    installNetworkCapture();
    logFreezeDiag('extraction-network-capture-installed', {
      durationMs: (performance.now() - networkCaptureStart).toFixed(2),
    });

    // If an ad is playing, wait for it to finish BEFORE attempting to get video data
    // This prevents false "no captions" errors and ensures we get the actual video's data
    const { isAdPlaying: adPlayingAtStart } = checkAdState();
    if (adPlayingAtStart) {
      logFreezeDiag('extraction-ad-detected-early', {
        message: 'Ad detected at extraction start, waiting for it to finish',
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const adFinished = await waitForAdToFinish(60000); // Wait up to 60 seconds
      if (!adFinished) {
        logFreezeDiag('extraction-ad-timeout', {
          message: 'Ad wait timed out after 60 seconds, returning AD_PLAYING error',
        });
        // Return AD_PLAYING error - don't try extraction during ad (it will fail and show wrong error)
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_ERROR', error: 'AD_PLAYING' };
      } else {
        logFreezeDiag('extraction-ad-finished', {
          message: 'Ad finished, proceeding with extraction',
          elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
        });
      }
    }

    // Wait for YouTube to load the new video (handles SPA navigation)
    const waitStart = performance.now();
    const { playerResponse, capture } = await waitForVideoReady();
    logFreezeDiag('extraction-waitForVideoReady-done', {
      durationMs: (performance.now() - waitStart).toFixed(2),
      hasPlayerResponse: !!playerResponse,
      captureVideoId: capture.videoId,
      hasTimedtextUrl: !!capture.timedtextUrl,
    });

    const initialDataStart = performance.now();
    const initialData = getInitialData();
    logFreezeDiag('extraction-getInitialData-done', {
      durationMs: (performance.now() - initialDataStart).toFixed(2),
      hasInitialData: !!initialData,
    });

    // Log diagnostic info
    logMain('Player response available:', !!playerResponse);
    logMain('Initial data available:', !!initialData);
    logMain('Capture store videoId:', capture.videoId);
    logMain('Capture store has timedtextUrl:', !!capture.timedtextUrl);
    if (playerResponse) {
      logMain('Player response videoId:', playerResponse.videoDetails?.videoId);
      logMain('Player response playabilityStatus:', playerResponse.playabilityStatus?.status);
      const captions = playerResponse.captions;
      logMain('Player response has captions object:', !!captions);
      if (captions) {
        logMain('Captions playerCaptionsTracklistRenderer:', !!captions.playerCaptionsTracklistRenderer);
        logMain('Caption tracks count:', captions.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0);
      }
    }

    // Get video title from player response, initial data, or DOM
    let videoTitle = playerResponse?.videoDetails?.title ?? 'Unknown';
    if (videoTitle === 'Unknown') {
      videoTitle = getVideoTitleFromDom();
    }
    logMain('Video title:', videoTitle);

    // PRIORITY 0: If we already have a captured timedtext URL for THIS video, try it first
    // This handles SPA navigation where playerResponse may not be available
    const capturedUrlMatchesVideo = capture.timedtextUrl &&
      capture.videoId === videoId;

    logFreezeDiag('extraction-priority0-check', {
      capturedUrlMatchesVideo,
      captureVideoId: capture.videoId,
      expectedVideoId: videoId,
      hasTimedtextUrl: !!capture.timedtextUrl,
      elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
    });

    if (capturedUrlMatchesVideo) {
      logMain('PRIORITY 0: Found pre-captured timedtext URL for current video, trying it first');
      const fetchStart = performance.now();
      const capturedTranscript = await fetchFromCapturedTimedtextUrl();
      logFreezeDiag('extraction-priority0-fetch-done', {
        durationMs: (performance.now() - fetchStart).toFixed(2),
        success: !!capturedTranscript,
        transcriptLength: capturedTranscript?.length ?? 0,
      });
      if (capturedTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from pre-captured timedtext URL');
        logMain('Transcript length:', capturedTranscript.length, 'chars');
        logFreezeDiag('extraction-complete', {
          method: 'pre-captured-timedtext',
          totalDurationMs: (performance.now() - extractionStartTime).toFixed(2),
          transcriptLength: capturedTranscript.length,
        });
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: capturedTranscript, videoTitle };
      }
    } else if (capture.timedtextUrl) {
      logMain('Captured timedtext URL is for different video:', capture.videoId, 'vs', videoId);
      // Clear stale capture data
      capture.timedtextUrl = undefined;
      capture.videoId = undefined;
      capture.pot = undefined;
    }

    // If no player response, try fetching fresh one from YouTubei API
    let activePlayerResponse = playerResponse;
    if (!activePlayerResponse) {
      logMain('No player response found from page, fetching fresh from YouTubei API');
      logFreezeDiag('extraction-fetchFreshPlayerResponse-start', {
        reason: 'no-page-response',
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const fetchStart = performance.now();
      activePlayerResponse = await fetchFreshPlayerResponse(videoId);
      logFreezeDiag('extraction-fetchFreshPlayerResponse-done', {
        durationMs: (performance.now() - fetchStart).toFixed(2),
        success: !!activePlayerResponse,
      });
      if (activePlayerResponse) {
        logMain('Got fresh player response from YouTubei API');
        videoTitle = activePlayerResponse?.videoDetails?.title ?? videoTitle;
      }
    }

    if (!activePlayerResponse) {
      logMain('No player response found even after fresh fetch');

      // Try triggering CC button to capture fresh timedtext URL
      logMain('FALLBACK: Trying to trigger CC button for fresh timedtext URL');
      const freshTranscript = await fetchFromCapturedTimedtextUrl();
      if (freshTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript after triggering CC button');
        logMain('Transcript length:', freshTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: freshTranscript, videoTitle };
      }

      // Try DOM extraction as last resort (skip if ad is playing)
      logMain('FALLBACK: Trying DOM transcript extraction');
      const domTranscript = await extractTranscriptFromDom(true);
      if (domTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from DOM');
        logMain('Transcript length:', domTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: domTranscript, videoTitle };
      }

      logMain('='.repeat(60));
      logMain('EXTRACTION FAILED: VIDEO_NOT_FOUND (no player response)');
      totalExtractionTimer();
      return { type: 'TRANSCRIPT_ERROR', error: 'VIDEO_NOT_FOUND' };
    }

    if (!initialData) {
      logMain('No initial data found');
    }

    // Use helper function to check multiple locations for caption tracks
    logFreezeDiag('extraction-extractCaptionTracks-start', {
      elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
    });
    const captionStart = performance.now();
    let captionTracks = extractCaptionTracks(activePlayerResponse).filter(Boolean);
    logFreezeDiag('extraction-extractCaptionTracks-done', {
      durationMs: (performance.now() - captionStart).toFixed(2),
      trackCount: captionTracks.length,
    });

    logMain('Caption tracks from page response:', captionTracks.length);

    if (captionTracks.length > 0 && !getCaptureStore().timedtextUrl) {
      logMain('Pre-capture: Trying to trigger timedtext via CC button');
      logFreezeDiag('extraction-precapture-cc-start', {
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const precaptureStart = performance.now();
      const precaptureTranscript = await fetchFromCapturedTimedtextUrl({
        allowClick: false,
        reason: 'pre-capture',
      });
      logFreezeDiag('extraction-precapture-cc-done', {
        durationMs: (performance.now() - precaptureStart).toFixed(2),
        success: !!precaptureTranscript,
        transcriptLength: precaptureTranscript?.length ?? 0,
      });
      if (precaptureTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from pre-capture CC trigger');
        logMain('Transcript length:', precaptureTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: precaptureTranscript, videoTitle };
      }
    }

    // If no caption tracks found, try fetching fresh player response
    if (captionTracks.length === 0 && activePlayerResponse === playerResponse) {
      logMain('No caption tracks in page response, fetching fresh player response');
      logFreezeDiag('extraction-fetchFreshPlayerResponse-start', {
        reason: 'no-caption-tracks',
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const fetchStart = performance.now();
      const freshResponse = await fetchFreshPlayerResponse(videoId);
      logFreezeDiag('extraction-fetchFreshPlayerResponse-done', {
        durationMs: (performance.now() - fetchStart).toFixed(2),
        success: !!freshResponse,
      });
      if (freshResponse) {
        captionTracks = extractCaptionTracks(freshResponse);
        logMain('Caption tracks from fresh response:', captionTracks.length);
        if (captionTracks.length > 0) {
          activePlayerResponse = freshResponse;
          videoTitle = freshResponse?.videoDetails?.title ?? videoTitle;
        }
      }
    }

    if (captionTracks.length === 0) {
      logMain('No caption tracks found in any source');
      logFreezeDiag('extraction-no-caption-tracks', {
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      logPageState('extraction-no-caption-tracks');

      // Check CC button status early for diagnostics only.
      const ccButton = document.querySelector('.ytp-subtitles-button') as HTMLElement | null;
      const ccAriaLabel = ccButton?.getAttribute('aria-label') ?? '';
      const captionsUnavailable = ccAriaLabel.toLowerCase().includes('unavailable');

      if (captionsUnavailable) {
        logMain('CC button indicates captions unavailable (continuing fallbacks)');
        logFreezeDiag('extraction-captions-unavailable-continue', {
          elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
          ariaLabel: ccAriaLabel,
        });
      }

      // Try triggering CC button to capture timedtext URL
      logMain('FALLBACK: Trying CC button to capture timedtext URL');
      logFreezeDiag('extraction-fallback-cc-start', {
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const ccStart = performance.now();
      const ccTranscript = await fetchFromCapturedTimedtextUrl();
      logFreezeDiag('extraction-fallback-cc-done', {
        durationMs: (performance.now() - ccStart).toFixed(2),
        success: !!ccTranscript,
        transcriptLength: ccTranscript?.length ?? 0,
      });
      if (ccTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from CC button trigger');
        logMain('Transcript length:', ccTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: ccTranscript, videoTitle };
      }

      logMain('FALLBACK: Trying initial data segments');
      logFreezeDiag('extraction-fallback-initialdata-start', {
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const initialDataStart = performance.now();
      // Skip expensive traversal during ad playback - won't find transcript anyway
      const initialTranscript = extractTranscriptSegments(initialData, true);
      logFreezeDiag('extraction-fallback-initialdata-done', {
        durationMs: (performance.now() - initialDataStart).toFixed(2),
        success: !!initialTranscript,
        transcriptLength: initialTranscript?.length ?? 0,
      });
      if (initialTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from initial data segments');
        logMain('Transcript length:', initialTranscript.length, 'chars');
        logFreezeDiag('extraction-complete', {
          method: 'initial-data-segments',
          totalDurationMs: (performance.now() - extractionStartTime).toFixed(2),
        });
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: initialTranscript, videoTitle };
      }

      logMain('FALLBACK: Trying YouTubei API');
      logFreezeDiag('extraction-fallback-youtubei-start', {
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      const youtubeiStart = performance.now();
      // Skip expensive operations during ad playback
      const apiTranscript = await fetchTranscriptFromYoutubei(initialData, true);
      logFreezeDiag('extraction-fallback-youtubei-done', {
        durationMs: (performance.now() - youtubeiStart).toFixed(2),
        success: !!apiTranscript,
        transcriptLength: apiTranscript?.length ?? 0,
      });
      if (apiTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from YouTubei API');
        logMain('Transcript length:', apiTranscript.length, 'chars');
        logFreezeDiag('extraction-complete', {
          method: 'youtubei-api',
          totalDurationMs: (performance.now() - extractionStartTime).toFixed(2),
        });
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: apiTranscript, videoTitle };
      }

      // Try DOM extraction as another fallback (skip if ad is playing)
      logMain('FALLBACK: Trying DOM transcript extraction');
      logFreezeDiag('extraction-fallback-dom-start', {
        elapsedMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      logPageState('extraction-fallback-dom-start');
      const domStart = performance.now();
      const domTranscript = await extractTranscriptFromDom(true);
      logFreezeDiag('extraction-fallback-dom-done', {
        durationMs: (performance.now() - domStart).toFixed(2),
        success: !!domTranscript,
        transcriptLength: domTranscript?.length ?? 0,
      });
      if (domTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from DOM');
        logMain('Transcript length:', domTranscript.length, 'chars');
        logFreezeDiag('extraction-complete', {
          method: 'dom-extraction',
          totalDurationMs: (performance.now() - extractionStartTime).toFixed(2),
        });
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: domTranscript, videoTitle };
      }

      // Check if ad is playing - if so, return AD_PLAYING instead of NO_CAPTIONS
      // because the video might actually have captions, we just can't extract during ad
      const { isAdPlaying: adPlayingAtFailure } = checkAdState();
      if (adPlayingAtFailure) {
        logMain('='.repeat(60));
        logMain('EXTRACTION DEFERRED: Ad is playing, returning AD_PLAYING');
        logFreezeDiag('extraction-deferred-ad', {
          error: 'AD_PLAYING',
          totalDurationMs: (performance.now() - extractionStartTime).toFixed(2),
        });
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_ERROR', error: 'AD_PLAYING' };
      }

      logMain('='.repeat(60));
      logMain('EXTRACTION FAILED: NO_CAPTIONS');
      logFreezeDiag('extraction-failed', {
        error: 'NO_CAPTIONS',
        totalDurationMs: (performance.now() - extractionStartTime).toFixed(2),
      });
      totalExtractionTimer();
      return { type: 'TRANSCRIPT_ERROR', error: 'NO_CAPTIONS' };
    }

    // Select best caption track with smart fallback:
    // 1. English manual captions
    // 2. English auto-generated
    // 3. Video's default language
    // 4. Browser locale
    // 5. First available track
    const defaultLang = activePlayerResponse.videoDetails?.defaultAudioLanguage;
    const browserLang = navigator.language.split('-')[0] ?? 'en'; // e.g., 'en-US' -> 'en'

    const findTrack = (lang: string, excludeAsr = false) =>
      captionTracks.find(
        (candidate: any) =>
          candidate.languageCode === lang && (!excludeAsr || candidate.kind !== 'asr')
      );

    const track =
      findTrack('en', true) ?? // English manual
      findTrack('en') ?? // English auto-generated
      (defaultLang && findTrack(defaultLang, true)) ?? // Video's language manual
      (defaultLang && findTrack(defaultLang)) ?? // Video's language auto-generated
      (browserLang !== 'en' && findTrack(browserLang, true)) ?? // Browser locale manual
      (browserLang !== 'en' && findTrack(browserLang)) ?? // Browser locale auto-generated
      captionTracks[0]; // Fallback to first available

    if (!track || !track.baseUrl) {
      logMain('No usable caption track/baseUrl, trying fallbacks');
      logFreezeDiag('extraction-no-usable-track', {
        captionTracksCount: captionTracks.length,
        hasTrack: !!track,
        hasBaseUrl: !!track?.baseUrl,
      });

      const ccTranscript = await fetchFromCapturedTimedtextUrl();
      if (ccTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from CC button trigger (no usable track)');
        logMain('Transcript length:', ccTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: ccTranscript, videoTitle };
      }

      const initialTranscript = extractTranscriptSegments(initialData, true);
      if (initialTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from initial data segments (no usable track)');
        logMain('Transcript length:', initialTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: initialTranscript, videoTitle };
      }

      const apiTranscript = await fetchTranscriptFromYoutubei(initialData, true);
      if (apiTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from YouTubei API (no usable track)');
        logMain('Transcript length:', apiTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: apiTranscript, videoTitle };
      }

      const domTranscript = await extractTranscriptFromDom(true);
      if (domTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from DOM (no usable track)');
        logMain('Transcript length:', domTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: domTranscript, videoTitle };
      }

      // Check if ad is playing before returning NO_CAPTIONS
      const { isAdPlaying: adAtTrackSelect } = checkAdState();
      if (adAtTrackSelect) {
        return { type: 'TRANSCRIPT_ERROR', error: 'AD_PLAYING' };
      }
      return { type: 'TRANSCRIPT_ERROR', error: 'NO_CAPTIONS' };
    }

    // Diagnostic logging for caption investigation
    const ccButtonDiag = document.querySelector('.ytp-subtitles-button') as HTMLElement | null;
    const ccLabelDiag = ccButtonDiag?.getAttribute('aria-label') ?? '';
    const ccPressedDiag = ccButtonDiag?.getAttribute('aria-pressed') ?? '';
    const isAsrTrack = track.kind === 'asr';

    logMain('='.repeat(60));
    logMain('CAPTION DIAGNOSTIC INFO:');
    logMain('  CC button aria-label:', ccLabelDiag);
    logMain('  CC button aria-pressed:', ccPressedDiag);
    logMain('  CC button exists:', !!ccButtonDiag);
    logMain('  Selected track language:', track.languageCode);
    logMain('  Selected track is ASR:', isAsrTrack);
    logMain('  Total caption tracks:', captionTracks.length);
    logMain('  Caption tracks detail:', captionTracks.map((t: any) => ({
      lang: t.languageCode,
      kind: t.kind,
      name: t.name?.simpleText ?? t.name,
    })));
    logMain('='.repeat(60));

    logFreezeDiag('caption-diagnostic', {
      ccLabel: ccLabelDiag,
      ccPressed: ccPressedDiag,
      ccExists: !!ccButtonDiag,
      trackLang: track.languageCode,
      isAsr: isAsrTrack,
      trackCount: captionTracks.length,
      tracks: captionTracks.map((t: any) => ({ lang: t.languageCode, kind: t.kind })),
    });

    logMain('Using caption track:', track.languageCode);
    logMain('Full baseUrl:', track.baseUrl);

    // PRIORITY 1: Try to trigger CC button click and use captured timedtext URL
    // This is the most reliable method as it uses YouTube's own authentication
    logMain('PRIORITY 1: Trying captured timedtext URL approach (trigger CC button)');
    const capturedTranscript = await fetchFromCapturedTimedtextUrl();
    if (capturedTranscript) {
      logMain('='.repeat(60));
      logMain('EXTRACTION SUCCESS: Got transcript from captured timedtext URL (CC button)');
      logMain('Transcript length:', capturedTranscript.length, 'chars');
      totalExtractionTimer();
      return { type: 'TRANSCRIPT_SUCCESS', transcript: capturedTranscript, videoTitle };
    }

    // Before PRIORITY 2: Check CC button state after PRIORITY 1 attempt
    const ccButtonForP2 = document.querySelector('.ytp-subtitles-button') as HTMLElement | null;
    const ccLabelForP2 = ccButtonForP2?.getAttribute('aria-label') ?? '';
    const ccPressedForP2 = ccButtonForP2?.getAttribute('aria-pressed') ?? '';

    logMain('CC button state after PRIORITY 1:', {
      ariaLabel: ccLabelForP2,
      ariaPressed: ccPressedForP2,
      isAsrTrack,
    });

    if (ccLabelForP2.toLowerCase().includes('unavailable')) {
      logMain('CC button STILL says unavailable after click attempt; continuing with direct fetch');
      logFreezeDiag('extraction-cc-still-unavailable-continue', {
        ariaLabel: ccLabelForP2,
        ariaPressed: ccPressedForP2,
        captionTracksCount: captionTracks.length,
        trackLanguage: track?.languageCode,
        isAsr: isAsrTrack,
      });
    }

    // PRIORITY 2: Try direct timedtext fetch (may work for some videos)
    logMain('PRIORITY 2: Trying direct timedtext fetch');
    const transcript = await fetchTranscript(track, videoId);
    if (!transcript) {
      logMain('Timedtext empty, trying initial data transcript');
      // Skip expensive traversal during ad playback - won't find transcript anyway
      const initialTranscript = extractTranscriptSegments(initialData, true);
      if (initialTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from initial data segments (after timedtext fail)');
        logMain('Transcript length:', initialTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: initialTranscript, videoTitle };
      }

      logMain('Timedtext empty, trying YouTubei transcript');
      // Skip expensive operations during ad playback
      const apiTranscript = await fetchTranscriptFromYoutubei(initialData, true);
      if (apiTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from YouTubei API (after timedtext fail)');
        logMain('Transcript length:', apiTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: apiTranscript, videoTitle };
      }

      logMain('Timedtext empty, trying DOM transcript extraction');
      // Skip if ad is playing
      const domTranscript = await extractTranscriptFromDom(true);
      if (domTranscript) {
        logMain('='.repeat(60));
        logMain('EXTRACTION SUCCESS: Got transcript from DOM (after timedtext fail)');
        logMain('Transcript length:', domTranscript.length, 'chars');
        totalExtractionTimer();
        return { type: 'TRANSCRIPT_SUCCESS', transcript: domTranscript, videoTitle };
      }

      logMainError('Transcript is empty after all attempts');
      logMainError('Extraction summary:', {
        pageVideoId: videoId,
        playerResponseVideoId: activePlayerResponse?.videoDetails?.videoId,
        captionTracksCount: captionTracks.length,
        trackLanguage: track?.languageCode,
        trackBaseUrl: track?.baseUrl?.substring(0, 100),
        captureVideoId: getCaptureStore().videoId,
        hasTimedtextUrl: !!getCaptureStore().timedtextUrl,
      });
      logMain('='.repeat(60));
      logMain('EXTRACTION FAILED: Empty transcript after all fallbacks');
      totalExtractionTimer();
      return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
    }

    logMain('='.repeat(60));
    logMain('EXTRACTION SUCCESS: Got transcript via direct timedtext fetch');
    logMain('Transcript length:', transcript.length, 'chars');
    logMain('Transcript preview:', transcript.substring(0, 200));
    totalExtractionTimer();

    return { type: 'TRANSCRIPT_SUCCESS', transcript, videoTitle };
  } catch (error) {
    logMainError('='.repeat(60));
    logMainError('EXTRACTION EXCEPTION:', error);
    logMainError('Error stack:', error instanceof Error ? error.stack : 'N/A');
    logMainError('Video ID:', videoId);
    logMainError('Page URL:', window.location.href);
    totalExtractionTimer();
    return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
  }
}
