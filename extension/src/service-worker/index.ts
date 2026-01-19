import type {
  RequestMessage,
  ResponseMessage,
  TranscriptResponse,
  SummaryResponse,
  SummaryError,
  VideoInfoResponse,
  ApiKeyResponse,
  SaveApiKeyResponse,
} from '../types/messages';
import type { Prompt } from '../types/prompt';
import { summarizeTranscript } from './openrouterApi';
import { extractTranscriptInPage } from './transcriptExtractor';
import { extractVideoInfoInPage } from './videoInfoExtractor';
import { initStreamingHandler } from './streamingHandler';
import { initChatHandler } from './chatHandler';
import { log, logError, logPerformance, logComponent } from '../utils/logger';
import { extractVideoId, isYouTubeVideoUrl } from '../utils/youtube';
import { getPromptById, getDefaultPrompt } from '../utils/promptStorage';
import { getModelContextLength } from '../utils/modelsApi';
import { STORAGE_KEYS } from '../config';

const SW_LOG = 'ServiceWorker';

// Error response type for validation helpers
interface SummaryErrorResponse {
  type: 'SUMMARY_ERROR';
  error: SummaryError;
}

const CONTEXT_MENU_ID = 'summarize-video';

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Summarize this video',
    contexts: ['page'],
    documentUrlPatterns: ['*://www.youtube.com/watch*'],
  });
  log('Context menu created');
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab?.id !== undefined) {
    log('Context menu clicked, opening side panel for tab:', tab.id);
    void chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Open side panel on icon click (also triggered by _execute_action keyboard shortcut)
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    log('Opening side panel for tab:', tab.id);
    void chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Message router
chrome.runtime.onMessage.addListener(
  (
    message: RequestMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ResponseMessage) => void
  ) => {
    const messageId = `${message.type}-${Date.now()}`;
    logComponent(SW_LOG, `Received message: ${message.type} (id: ${messageId})`);
    const perf = logPerformance(SW_LOG, `handleMessage ${message.type}`);

    handleMessage(message, sender)
      .then((response) => {
        perf.end();
        // Only send response if we have one (PING returns undefined)
        if (response !== undefined) {
          logComponent(SW_LOG, `Sending response for ${message.type}:`, response.type);
          sendResponse(response);
        }
      })
      .catch((error: unknown) => {
        perf.end();
        logError('Error handling message:', message.type, error);
        sendResponse({ type: 'SUMMARY_ERROR', error: 'API_ERROR' });
      });
    return true; // Keep channel open for async response
  }
);

// Initialize streaming handler with transcript fetcher
initStreamingHandler(getTranscriptForTab);

// Initialize chat handler with transcript fetcher
initChatHandler(getTranscriptForTab);

async function handleMessage(
  message: RequestMessage,
  sender: chrome.runtime.MessageSender
): Promise<ResponseMessage | undefined> {
  switch (message.type) {
    case 'GET_SUMMARY':
      return handleGetSummary(message.promptId, message.modelId, message.tabId, message.videoId, sender);
    case 'GET_TRANSCRIPT':
      // This shouldn't happen - transcripts are fetched by content script
      return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
    case 'GET_VIDEO_INFO':
      return handleGetVideoInfo(message.tabId, sender);
    case 'GET_API_KEY':
      return handleGetApiKey();
    case 'SAVE_API_KEY':
      return handleSaveApiKey(message.apiKey);
    case 'PING':
      // PING is only used for content script communication, not service worker
      return undefined;
    default: {
      // Exhaustive check - TypeScript will error if a case is missing
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

async function resolveTab(
  tabId: number | undefined,
  sender: chrome.runtime.MessageSender
): Promise<chrome.tabs.Tab | null> {
  if (tabId !== undefined) {
    try {
      return await chrome.tabs.get(tabId);
    } catch (error) {
      logError('Failed to get tab by ID:', error);
      return null;
    }
  }

  if (sender.tab) {
    return sender.tab;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

// Validation helper: Get API key from storage
async function getApiKeyOrError(): Promise<string | SummaryErrorResponse> {
  const storage = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
  const apiKey = storage[STORAGE_KEYS.API_KEY] as string | undefined;

  if (!apiKey) {
    log('No API key configured');
    return { type: 'SUMMARY_ERROR', error: 'NO_API_KEY' };
  }
  return apiKey;
}

interface PromptAndModel {
  prompt: Prompt;
  modelId: string;
}

// Validation helper: Resolve and validate prompt/model
async function getPromptAndModelOrError(
  promptId?: string,
  modelIdOverride?: string
): Promise<PromptAndModel | SummaryErrorResponse> {
  const prompt = promptId
    ? await getPromptById(promptId)
    : await getDefaultPrompt();

  if (!prompt) {
    logError('Prompt not found:', promptId);
    return { type: 'SUMMARY_ERROR', error: 'API_ERROR' };
  }

  const modelId = modelIdOverride ?? prompt.model;
  log('Using prompt:', prompt.name);
  log('Using model:', modelId);

  return { prompt, modelId };
}

function isPromptAndModel(value: PromptAndModel | SummaryErrorResponse): value is PromptAndModel {
  return 'prompt' in value;
}

// Validation helper: Validate tab is on YouTube video page
async function getYouTubeTabOrError(
  tabId: number | undefined,
  sender: chrome.runtime.MessageSender,
  expectedVideoId?: string
): Promise<{ tabId: number; videoId: string } | SummaryErrorResponse> {
  const tab = await resolveTab(tabId, sender);

  if (!tab?.url || !isYouTubeVideoUrl(tab.url)) {
    log('Not on YouTube video page');
    return { type: 'SUMMARY_ERROR', error: 'NOT_YOUTUBE_VIDEO' };
  }

  if (tab.id === undefined) {
    logError('Tab ID is undefined');
    return { type: 'SUMMARY_ERROR', error: 'API_ERROR' };
  }

  const videoId = extractVideoId(tab.url);
  if (!videoId) {
    logError('Could not extract video ID');
    return { type: 'SUMMARY_ERROR', error: 'VIDEO_NOT_FOUND' };
  }

  if (expectedVideoId && videoId !== expectedVideoId) {
    log('Video ID mismatch for summary request:', videoId, 'expected:', expectedVideoId);
    return { type: 'SUMMARY_ERROR', error: 'VIDEO_NOT_FOUND' };
  }

  return { tabId: tab.id, videoId };
}

// Validation helper: Check if transcript fits in model context
async function checkContextLengthOrError(
  transcriptLength: number,
  modelId: string,
  apiKey: string
): Promise<null | SummaryErrorResponse> {
  const estimatedTokens = Math.ceil(transcriptLength / 4);

  try {
    const contextLength = await getModelContextLength(modelId, apiKey);

    if (contextLength !== null) {
      const maxSafeTokens = Math.floor(contextLength * 0.9);
      if (estimatedTokens > maxSafeTokens) {
        log('Transcript too long:', estimatedTokens, 'tokens, max:', maxSafeTokens);
        return { type: 'SUMMARY_ERROR', error: 'CONTEXT_TOO_LONG' };
      }
    }
  } catch (error) {
    // Models API failed and no cache available - skip context check and proceed
    log('Could not verify context length, proceeding anyway:', error);
  }

  return null;
}

function isSummaryError(value: unknown): value is SummaryErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'SUMMARY_ERROR'
  );
}

async function handleGetSummary(
  promptId?: string,
  modelIdOverride?: string,
  tabId?: number,
  expectedVideoId?: string,
  sender?: chrome.runtime.MessageSender
): Promise<SummaryResponse> {
  // 1. Validate API key
  const apiKeyResult = await getApiKeyOrError();
  if (isSummaryError(apiKeyResult)) {
    return apiKeyResult;
  }
  const apiKey = apiKeyResult;

  // 2. Resolve prompt and model
  const promptResult = await getPromptAndModelOrError(promptId, modelIdOverride);
  if (!isPromptAndModel(promptResult)) {
    return promptResult;
  }
  const { prompt, modelId } = promptResult;

  // 3. Validate tab is on YouTube video page
  const resolvedSender = sender ?? { tab: undefined };
  const tabResult = await getYouTubeTabOrError(tabId, resolvedSender, expectedVideoId);
  if (isSummaryError(tabResult)) {
    return tabResult;
  }
  const { tabId: resolvedTabId, videoId } = tabResult;

  // 4. Get transcript
  log('Requesting transcript from tab:', resolvedTabId);
  const transcriptResponse = await getTranscriptForTab(resolvedTabId, videoId);
  if (transcriptResponse.type === 'TRANSCRIPT_ERROR') {
    log('Transcript error:', transcriptResponse.error);
    return { type: 'SUMMARY_ERROR', error: transcriptResponse.error };
  }

  // 5. Validate context length
  const contextError = await checkContextLengthOrError(
    transcriptResponse.transcript.length,
    modelId,
    apiKey
  );
  if (contextError) {
    return contextError;
  }

  // 6. Generate summary
  log('Calling OpenRouter API');
  const summary = await summarizeTranscript({
    transcript: transcriptResponse.transcript,
    apiKey,
    prompt: prompt.text,
    model: modelId,
  });

  if (!summary.success) {
    logError('Summary error:', summary.error);
    return { type: 'SUMMARY_ERROR', error: summary.error };
  }

  log('Summary generated successfully');
  return {
    type: 'SUMMARY_SUCCESS',
    summary: summary.data,
    videoTitle: transcriptResponse.videoTitle,
    promptId: prompt.id,
    modelId,
  };
}

// Freeze diagnostic logging helper
const logFreezeDiag = (context: string, data: Record<string, unknown>) => {
  log(`[FREEZE-DIAG][${context}]`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
};

async function getTranscriptForTab(
  tabId: number,
  videoId: string
): Promise<TranscriptResponse> {
  const startTime = performance.now();
  const perf = logPerformance(SW_LOG, `getTranscriptForTab(${videoId})`);
  logComponent(SW_LOG, '='.repeat(60));
  logComponent(SW_LOG, 'GET TRANSCRIPT START');
  logComponent(SW_LOG, `  tabId: ${tabId}, videoId: ${videoId}`);
  logComponent(SW_LOG, `  timestamp: ${new Date().toISOString()}`);

  logFreezeDiag('getTranscriptForTab-start', {
    tabId,
    videoId,
  });

  // Method 1: Try page context extraction (has full YouTube session access)
  // Uses CC button click to trigger subtitle loading, then fetches from captured timedtext URL
  logComponent(SW_LOG, 'Method 1: Attempting transcript extraction via page context (MAIN world)');
  logFreezeDiag('method1-start', { tabId, videoId });
  const method1Perf = logPerformance(SW_LOG, 'Method 1: MAIN world extraction');
  const mainWorldResponse = await tryExtractTranscriptInPage(tabId, videoId);
  const method1Duration = performance.now() - startTime;
  method1Perf.end();
  logFreezeDiag('method1-complete', {
    tabId,
    videoId,
    durationMs: method1Duration.toFixed(2),
    result: mainWorldResponse?.type ?? 'null',
  });

  logComponent(SW_LOG, 'Method 1 result:', mainWorldResponse?.type,
    mainWorldResponse?.type === 'TRANSCRIPT_ERROR' ? `error: ${mainWorldResponse.error}` : '',
    mainWorldResponse?.type === 'TRANSCRIPT_SUCCESS' ? `length: ${mainWorldResponse.transcript.length}` : '');

  if (mainWorldResponse?.type === 'TRANSCRIPT_SUCCESS') {
    logComponent(SW_LOG, 'GET TRANSCRIPT SUCCESS (Method 1: MAIN world)');
    logComponent(SW_LOG, '='.repeat(60));
    logFreezeDiag('getTranscriptForTab-complete', {
      tabId,
      videoId,
      totalDurationMs: (performance.now() - startTime).toFixed(2),
      method: 'main-world',
      transcriptLength: mainWorldResponse.transcript.length,
    });
    perf.end();
    return mainWorldResponse;
  }

  // Return specific errors (like NO_CAPTIONS) without fallback
  if (
    mainWorldResponse?.type === 'TRANSCRIPT_ERROR' &&
    mainWorldResponse.error !== 'EXTRACTION_FAILED' &&
    mainWorldResponse.error !== 'VIDEO_NOT_FOUND'
  ) {
    logComponent(SW_LOG, 'GET TRANSCRIPT ERROR (specific error, no fallback):', mainWorldResponse.error);
    logComponent(SW_LOG, '='.repeat(60));
    perf.end();
    return mainWorldResponse;
  }

  // Method 2: Fall back to content script (last resort)
  try {
    const method2StartTime = performance.now();
    logComponent(SW_LOG, 'Method 2: Falling back to content script transcript extraction');
    logFreezeDiag('method2-start', { tabId, videoId });
    const method2Perf = logPerformance(SW_LOG, 'Method 2: Content script extraction');

    // Ensure content script is injected (may not be after SPA navigation)
    logComponent(SW_LOG, '  Ensuring content script is injected...');
    const injectionStart = performance.now();
    const injected = await ensureContentScriptInjected(tabId);
    logFreezeDiag('method2-injection', {
      tabId,
      injected,
      durationMs: (performance.now() - injectionStart).toFixed(2),
    });
    logComponent(SW_LOG, '  Content script injection result:', injected);

    if (!injected) {
      logError('Could not inject content script, cannot fall back');
      logComponent(SW_LOG, 'GET TRANSCRIPT ERROR (injection failed)');
      logComponent(SW_LOG, '='.repeat(60));
      logFreezeDiag('method2-injection-failed', { tabId, videoId });
      method2Perf.end();
      perf.end();
      return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
    }

    logComponent(SW_LOG, '  Sending GET_TRANSCRIPT message to content script...');
    const messageStart = performance.now();
    const contentScriptResponse: TranscriptResponse = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_TRANSCRIPT',
      videoId,
    });
    const method2Duration = performance.now() - method2StartTime;
    method2Perf.end();

    logFreezeDiag('method2-complete', {
      tabId,
      videoId,
      durationMs: method2Duration.toFixed(2),
      messageDurationMs: (performance.now() - messageStart).toFixed(2),
      result: contentScriptResponse.type,
    });

    logComponent(SW_LOG, 'Method 2 result:', contentScriptResponse.type,
      contentScriptResponse.type === 'TRANSCRIPT_ERROR' ? `error: ${contentScriptResponse.error}` : '',
      contentScriptResponse.type === 'TRANSCRIPT_SUCCESS' ? `length: ${contentScriptResponse.transcript.length}` : '');
    logComponent(SW_LOG, 'GET TRANSCRIPT END');
    logComponent(SW_LOG, '='.repeat(60));

    const totalDuration = performance.now() - startTime;
    logFreezeDiag('getTranscriptForTab-complete', {
      tabId,
      videoId,
      totalDurationMs: totalDuration.toFixed(2),
      method: 'content-script',
    });

    perf.end();
    return contentScriptResponse;
  } catch (error) {
    logError('Content script transcript fetch failed:', error);
    logComponent(SW_LOG, 'GET TRANSCRIPT ERROR (content script exception)');
    logComponent(SW_LOG, '='.repeat(60));
    logFreezeDiag('method2-exception', {
      tabId,
      videoId,
      error: error instanceof Error ? error.message : String(error),
    });
    perf.end();
    return { type: 'TRANSCRIPT_ERROR', error: 'EXTRACTION_FAILED' };
  }
}

async function tryExtractTranscriptInPage(
  tabId: number,
  videoId: string
): Promise<TranscriptResponse | null> {
  try {
    log('Executing transcript extraction script in MAIN world for tab:', tabId, 'video:', videoId);
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: extractTranscriptInPage,
      args: [videoId, import.meta.env.MODE === 'development'],
    });

    const result = results
      .map((entry) => entry.result)
      .find(Boolean);

    if (!result) {
      log('No transcript result returned from page context (results:', results.length, ')');
      return null;
    }

    log('Page context extraction returned:', result.type);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('Page context transcript extraction failed:', errorMessage);
    // Common errors:
    // - "Cannot access contents of the page" - page not fully loaded or restricted
    // - "No tab with id" - tab was closed
    // - "Frame not found" - navigation in progress
    return null;
  }
}

// Track tabs where injection failed to avoid repeated injection attempts
// (can happen with restricted pages or after extension updates with incompatible content scripts)
const injectionFailedTabs = new Set<number>();

/**
 * Ensure content script is injected into the tab.
 * This is needed after SPA navigation when the content script may not be re-injected.
 *
 * Note: After extension updates, old content scripts may not have the PING handler.
 * We verify injection worked by sending another PING after injection.
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  // Skip tabs where injection previously failed
  if (injectionFailedTabs.has(tabId)) {
    log('Skipping injection for tab (previously failed):', tabId);
    return false;
  }

  try {
    // Try to ping the content script first
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    // Content script not loaded or doesn't have PING handler, try to inject
    try {
      log('Injecting content script into tab:', tabId);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js'],
      });
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify injection worked by sending another PING
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        return true;
      } catch {
        // Injection didn't help - possibly old content script without PING handler
        // or multiple content scripts causing issues. Mark tab as failed.
        log('Content script injection did not resolve PING failure for tab:', tabId);
        injectionFailedTabs.add(tabId);
        return false;
      }
    } catch (error) {
      logError('Failed to inject content script:', error);
      injectionFailedTabs.add(tabId);
      return false;
    }
  }
}

// Clear injection failed state when tab navigates (gives a fresh chance)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && injectionFailedTabs.has(tabId)) {
    injectionFailedTabs.delete(tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectionFailedTabs.delete(tabId);
});

async function handleGetApiKey(): Promise<ApiKeyResponse> {
  try {
    const storage = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    const hasKey = Boolean(storage[STORAGE_KEYS.API_KEY]);
    return { type: 'API_KEY_SUCCESS', hasKey };
  } catch (error) {
    logError('Error getting API key:', error);
    return { type: 'API_KEY_ERROR', error: 'Failed to get API key' };
  }
}

async function handleSaveApiKey(apiKey: string): Promise<SaveApiKeyResponse> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey });
    log('API key saved');
    return { type: 'SAVE_API_KEY_SUCCESS' };
  } catch (error) {
    logError('Error saving API key:', error);
    return { type: 'SAVE_API_KEY_ERROR', error: 'Failed to save API key' };
  }
}

async function handleGetVideoInfo(
  tabId?: number,
  sender?: chrome.runtime.MessageSender
): Promise<VideoInfoResponse> {
  try {
    const resolvedSender = sender ?? { tab: undefined };
    const tab = await resolveTab(tabId, resolvedSender);

    if (!tab?.url || !isYouTubeVideoUrl(tab.url)) {
      return { type: 'VIDEO_INFO_ERROR', error: 'Not on YouTube video page' };
    }

    if (tab.id === undefined) {
      return { type: 'VIDEO_INFO_ERROR', error: 'Tab ID is undefined' };
    }

    const videoId = extractVideoId(tab.url);
    if (!videoId) {
      return { type: 'VIDEO_INFO_ERROR', error: 'Could not extract video ID' };
    }

    // Execute lightweight script to get video info from page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: extractVideoInfoInPage,
      args: [videoId, import.meta.env.MODE === 'development'],
    });

    const result = results
      .map((entry) => entry.result)
      .find(Boolean);

    if (!result) {
      return { type: 'VIDEO_INFO_ERROR', error: 'No result from page context' };
    }

    return result;
  } catch (error) {
    logError('Error getting video info:', error);
    return { type: 'VIDEO_INFO_ERROR', error: String(error) };
  }
}
