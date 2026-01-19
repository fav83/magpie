import type { StreamPortRequest, StreamPortResponse, TranscriptResponse, SummaryError } from '../types/messages';
import { streamSummary } from './openrouterApi';
import { log, logError } from '../utils/logger';
import { isYouTubeVideoUrl } from '../utils/youtube';
import { getPromptById } from '../utils/promptStorage';
import { getModelContextLength } from '../utils/modelsApi';
import { STORAGE_KEYS, PORT_NAMES } from '../config';

// Track active streaming connections
const activeStreams = new Map<string, AbortController>();

/**
 * Helper to send stream error messages with consistent structure
 */
function createStreamError(
  error: SummaryError,
  videoId: string,
  promptId: string,
  partialContent: string | null = null,
  errorDetails?: string
): StreamPortResponse {
  return {
    type: 'STREAM_ERROR',
    error,
    partialContent,
    videoId,
    promptId,
    ...(errorDetails !== undefined && { errorDetails }),
  };
}

/**
 * Initialize the streaming port handler
 * Call this once when the service worker starts
 */
export function initStreamingHandler(
  getTranscriptForTab: (tabId: number, videoId: string) => Promise<TranscriptResponse>
): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAMES.SUMMARY_STREAM) return;

    log('Streaming port connected');
    let currentStreamId: string | null = null;
    let abortController: AbortController | null = null;

    const sendMessage = (message: StreamPortResponse) => {
      try {
        port.postMessage(message);
      } catch (error) {
        logError('Failed to send message on port:', error);
      }
    };

    port.onMessage.addListener((message: StreamPortRequest) => {
      switch (message.type) {
        case 'STREAM_SUMMARY':
          // Create stream ID and abort controller
          currentStreamId = `${message.videoId}_${message.promptId}`;
          abortController = new AbortController();
          activeStreams.set(currentStreamId, abortController);

          // Start streaming (don't await - runs in background)
          void handleStreamingSummary(
            message.videoId,
            message.promptId,
            message.modelId,
            message.tabId,
            sendMessage,
            abortController.signal,
            getTranscriptForTab,
            message.customPromptText
          ).finally(() => {
            if (currentStreamId) {
              activeStreams.delete(currentStreamId);
            }
          });
          break;

        case 'CANCEL_STREAM':
          log('Cancel stream requested');
          abortController?.abort();
          break;

        case 'KEEPALIVE':
          sendMessage({ type: 'KEEPALIVE_ACK' });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      log('Streaming port disconnected');
      // Abort any active stream when port disconnects
      abortController?.abort();
      if (currentStreamId) {
        activeStreams.delete(currentStreamId);
      }
    });
  });
}

async function handleStreamingSummary(
  videoId: string,
  promptId: string,
  modelId: string,
  tabId: number,
  sendMessage: (message: StreamPortResponse) => void,
  signal: AbortSignal,
  getTranscriptForTab: (tabId: number, videoId: string) => Promise<TranscriptResponse>,
  customPromptText?: string
): Promise<void> {
  log('=== STREAMING HANDLER START ===');
  log('Received request - videoId:', videoId, 'promptId:', promptId, 'modelId:', modelId, 'tabId:', tabId);

  // 1. Check for API key
  const storage = await chrome.storage.local.get([STORAGE_KEYS.API_KEY]);
  const openrouterApiKey = storage[STORAGE_KEYS.API_KEY] as string | undefined;

  if (!openrouterApiKey) {
    log('No API key configured');
    sendMessage(createStreamError('NO_API_KEY', videoId, promptId));
    return;
  }

  // 2. Get the prompt text (use custom text if provided, otherwise load from storage)
  let promptText: string;
  let promptName: string;

  if (customPromptText) {
    promptText = customPromptText;
    promptName = 'Custom prompt';
    log('Using custom prompt text');
  } else {
    const prompt = await getPromptById(promptId);
    if (!prompt) {
      logError('Prompt not found:', promptId);
      sendMessage(createStreamError('API_ERROR', videoId, promptId));
      return;
    }
    promptText = prompt.text;
    promptName = prompt.name;
  }

  log('Streaming with prompt:', promptName);
  log('Streaming with model:', modelId);

  // 3. Validate tab exists and is on YouTube
  // Note: We don't validate video ID here because:
  // 1. The transcript extraction already validates video IDs
  // 2. After SPA navigation, tab.url might briefly be stale
  // 3. Video ID validation causes issues when quickly switching videos
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (error) {
    logError('Failed to get tab:', error);
    sendMessage(createStreamError('NOT_YOUTUBE_VIDEO', videoId, promptId));
    return;
  }

  if (!tab.url || !isYouTubeVideoUrl(tab.url)) {
    log('Not on YouTube video page');
    sendMessage(createStreamError('NOT_YOUTUBE_VIDEO', videoId, promptId));
    return;
  }

  log('Tab URL:', tab.url, 'Requested videoId:', videoId);

  // 4. Get transcript (with retry for AD_PLAYING)
  log('Getting transcript for tab:', tabId, 'videoId:', videoId);
  let transcriptResponse = await getTranscriptForTab(tabId, videoId);
  log('Transcript response type:', transcriptResponse.type);

  // Auto-retry if ad is playing (up to 3 retries with 5s delay)
  const MAX_AD_RETRIES = 3;
  const AD_RETRY_DELAY_MS = 5000;
  let adRetryCount = 0;

  while (
    transcriptResponse.type === 'TRANSCRIPT_ERROR' &&
    transcriptResponse.error === 'AD_PLAYING' &&
    adRetryCount < MAX_AD_RETRIES &&
    !signal.aborted
  ) {
    adRetryCount++;
    log(`Ad playing, retry ${adRetryCount}/${MAX_AD_RETRIES} in ${AD_RETRY_DELAY_MS}ms...`);

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, AD_RETRY_DELAY_MS));

    if (signal.aborted) {
      log('Stream cancelled during ad retry wait');
      return;
    }

    // Retry transcript extraction
    transcriptResponse = await getTranscriptForTab(tabId, videoId);
    log(`Retry ${adRetryCount} result:`, transcriptResponse.type);
  }

  if (transcriptResponse.type === 'TRANSCRIPT_ERROR') {
    log('=== STREAMING HANDLER ERROR (transcript) ===');
    log('Transcript error:', transcriptResponse.error);
    sendMessage(createStreamError(transcriptResponse.error, videoId, promptId));
    return;
  }

  log('Transcript received, length:', transcriptResponse.transcript.length);

  // 6. Check context length
  const estimatedTokens = Math.ceil(transcriptResponse.transcript.length / 4);
  try {
    const contextLength = await getModelContextLength(modelId, openrouterApiKey);
    if (contextLength !== null) {
      const maxSafeTokens = Math.floor(contextLength * 0.9);
      if (estimatedTokens > maxSafeTokens) {
        log('Transcript too long:', estimatedTokens, 'tokens, max:', maxSafeTokens);
        sendMessage(createStreamError('CONTEXT_TOO_LONG', videoId, promptId));
        return;
      }
    }
  } catch (error) {
    log('Could not verify context length, proceeding anyway:', error);
  }

  // 7. Start streaming
  log('Starting streaming summary generation');
  await streamSummary({
    transcript: transcriptResponse.transcript,
    apiKey: openrouterApiKey,
    prompt: promptText,
    model: modelId,
    callbacks: {
      onChunk: (content) => {
        sendMessage({ type: 'STREAM_CHUNK', content, videoId, promptId });
      },
      onComplete: (fullContent) => {
        sendMessage({
          type: 'STREAM_COMPLETE',
          videoId,
          videoTitle: transcriptResponse.videoTitle,
          promptId,
          modelId,
          fullContent,
        });
      },
      onError: (error, partialContent, errorDetails) => {
        sendMessage(createStreamError(error, videoId, promptId, partialContent, errorDetails));
      },
    },
    signal,
  });
}
