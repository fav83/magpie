/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/unbound-method */
// This file interacts with YouTube's internal untyped APIs which require any types

import type { CaptureStore, WindowWithCapture } from '../types/transcript';

(() => {
  // Symbol marker to detect if fetch/XHR are already wrapped by us
  const WRAPPER_MARKER = Symbol.for('yt-summarizer-wrapped');

  const win = window as WindowWithCapture;
  const existing = win.__ytSummarizerCapture;

  // Check both our flag and markers on the functions themselves
  const fetchAlreadyWrapped = (window.fetch as any)?.[WRAPPER_MARKER] === true;
  if (existing?.installed || fetchAlreadyWrapped) {
    return;
  }

  const capture: CaptureStore = existing ?? {};
  capture.installed = true;
  win.__ytSummarizerCapture = capture;

  // Only enable logging in development mode (when built with --mode development)
  const DEBUG_MODE = import.meta.env.MODE === 'development';
  const logPrefix = '[YT-Summarizer][capture]';

  // Log installation for debugging double-wrap issues (only in dev)
  if (DEBUG_MODE) {
    console.log(logPrefix, 'Network capture installed at', new Date().toISOString());
    console.log(logPrefix, 'Page URL:', window.location.href);
  }

  const log = (message: string, ...args: unknown[]) => {
    if (!DEBUG_MODE) return;
    try {
      console.log(logPrefix, message, ...args);
    } catch {
      // Ignore logging failures
    }
  };

  const logWarn = (message: string, ...args: unknown[]) => {
    if (!DEBUG_MODE) return;
    try {
      console.warn(logPrefix, message, ...args);
    } catch {
      // Ignore logging failures
    }
  };

  // ============================================================================
  // FREEZE DIAGNOSTIC TRACKING
  // Track request frequency to help diagnose freeze issues during ads
  // ============================================================================
  let requestCount = 0;
  let lastRequestTime = 0;
  let highFrequencyAlertLogged = false;

  // Log freeze diagnostics only in dev mode
  const logFreezeDiag = (context: string, data: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.log(`${logPrefix}[FREEZE-DIAG][${context}]`, {
      timestamp: new Date().toISOString(),
      requestCount,
      ...data,
    });
  };

  const trackRequest = (url: string) => {
    requestCount++;
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;

    // Alert if requests are coming in very fast (possible ad bombardment)
    if (timeSinceLast < 50 && requestCount > 10 && !highFrequencyAlertLogged) {
      logFreezeDiag('high-request-frequency', {
        timeSinceLastMs: timeSinceLast,
        urlSample: url.substring(0, 100),
      });
      highFrequencyAlertLogged = true;
    }

    // Reset alert flag after 1 second of normal activity
    if (timeSinceLast > 1000) {
      highFrequencyAlertLogged = false;
    }

    lastRequestTime = now;
  };

  const extractParam = (url: string, key: string): string => {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.searchParams.get(key) ?? '';
    } catch {
      return '';
    }
  };

  const walkObject = (node: unknown, visit: (value: any) => void): void => {
    if (!node || typeof node !== 'object') {
      return;
    }

    visit(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        walkObject(item, visit);
      }
      return;
    }

    for (const value of Object.values(node as Record<string, unknown>)) {
      walkObject(value, visit);
    }
  };

  const findPoToken = (data: any): string => {
    let found = '';
    walkObject(data, (node) => {
      if (found) {
        return;
      }
      const candidate = node?.serviceIntegrityDimensions?.poToken;
      if (typeof candidate === 'string') {
        found = candidate;
      }
    });
    return found;
  };

  const findClientName = (data: any): string => {
    let found = '';
    walkObject(data, (node) => {
      if (found) {
        return;
      }
      const candidate = node?.context?.client?.clientName ?? node?.client?.clientName;
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        found = String(candidate);
      }
    });
    return found;
  };

  const parseParamValue = (value: string): unknown => {
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
  };

  const parseUrlEncoded = (text: string): Record<string, unknown> | null => {
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
  };

  const parseRequestBody = (body: unknown): any | null => {
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
  };

  const maybeCaptureRequest = (url: string, body?: unknown) => {
    const startTime = performance.now();

    // Track all requests for freeze diagnosis
    trackRequest(url);

    if (body instanceof Blob) {
      body
        .text()
        .then((text) => { maybeCaptureRequest(url, text); })
        .catch(() => undefined);
      return;
    }

    if (url.includes('/api/timedtext')) {
      const newVideoId = extractParam(url, 'v');
      const timestamp = new Date().toISOString();

      log(`[${timestamp}] Intercepted timedtext request for video:`, newVideoId);
      log(`  URL length: ${url.length} chars`);

      logFreezeDiag('timedtext-captured', {
        newVideoId,
        previousVideoId: capture.videoId,
        videoIdChanged: newVideoId !== capture.videoId,
      });

      // If video ID changed, clear old capture data
      if (newVideoId && capture.videoId && newVideoId !== capture.videoId) {
        logWarn(`Video changed from ${capture.videoId} to ${newVideoId}, clearing old capture data`);
        logFreezeDiag('video-id-changed', {
          fromVideoId: capture.videoId,
          toVideoId: newVideoId,
        });
        delete capture.timedtextUrl;
        delete capture.pot;
      }

      // Always update timedtext URL (latest is for current video)
      capture.timedtextUrl = url;
      if (newVideoId) {
        capture.videoId = newVideoId;
      }
      log('  Stored timedtext URL, capture state:', {
        videoId: capture.videoId,
        hasTimedtextUrl: !!capture.timedtextUrl,
        hasPot: !!capture.pot,
      });

      const pot = extractParam(url, 'pot');
      if (pot) {
        capture.pot = pot;
        log('  Captured PO token from timedtext URL (length:', pot.length, ')');
      }

      const clientName = extractParam(url, 'c');
      if (clientName) {
        capture.clientName = clientName;
        log('  Captured clientName:', clientName);
      }

      const timedtextDuration = performance.now() - startTime;
      if (timedtextDuration > 2) {
        logFreezeDiag('timedtext-request-slow', {
          durationMs: timedtextDuration.toFixed(2),
          videoId: newVideoId,
        });
      }
      return;
    }

    if (!url.includes('/youtubei/v1/player')) {
      return;
    }

    const timestamp = new Date().toISOString();
    log(`[${timestamp}] Intercepted player request`);

    const parseStart = performance.now();
    const parsedBody = parseRequestBody(body);
    const parseDuration = performance.now() - parseStart;

    if (!parsedBody) {
      log('  Could not parse request body');
      return;
    }

    const walkStart = performance.now();
    const pot = findPoToken(parsedBody);
    const potDuration = performance.now() - walkStart;

    if (pot && !capture.pot) {
      capture.pot = pot;
      log('  Captured PO token from player request (length:', pot.length, ')');
    }

    const clientStart = performance.now();
    const clientName = findClientName(parsedBody);
    const clientDuration = performance.now() - clientStart;

    if (clientName && !capture.clientName) {
      capture.clientName = clientName;
      log('  Captured clientName from player request:', clientName);
    }

    const totalDuration = performance.now() - startTime;
    // Log if player request processing took more than 5ms (potential freeze contributor)
    if (totalDuration > 5) {
      logFreezeDiag('player-request-slow', {
        totalDurationMs: totalDuration.toFixed(2),
        parseDurationMs: parseDuration.toFixed(2),
        potWalkDurationMs: potDuration.toFixed(2),
        clientWalkDurationMs: clientDuration.toFixed(2),
        bodySize: typeof body === 'string' ? body.length : 'unknown',
      });
    }
  };

  const originalFetch = window.fetch.bind(window);
  const wrappedFetch = (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> => {
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

  // Mark the wrapped function to detect double-wrapping
  (wrappedFetch as any)[WRAPPER_MARKER] = true;
  window.fetch = wrappedFetch;

  const originalOpen = XMLHttpRequest.prototype.open;
  const wrappedOpen = function (
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
  (wrappedOpen as any)[WRAPPER_MARKER] = true;
  XMLHttpRequest.prototype.open = wrappedOpen;

  const originalSend = XMLHttpRequest.prototype.send;
  const wrappedSend = function (
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
  (wrappedSend as any)[WRAPPER_MARKER] = true;
  XMLHttpRequest.prototype.send = wrappedSend;
})();
