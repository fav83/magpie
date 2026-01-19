import type { ChatPortRequest, ChatPortResponse, SummaryError, TranscriptResponse } from '../types/messages';
import { streamChat } from './openrouterApi';
import { log, logError } from '../utils/logger';
import { STORAGE_KEYS, PORT_NAMES, DEFAULT_CHAT_SYSTEM_PROMPT } from '../config';

/**
 * Helper to send chat error messages with consistent structure
 */
function createChatError(
  error: SummaryError,
  videoId: string,
  partialContent: string | null = null,
  errorDetails?: string
): ChatPortResponse {
  return {
    type: 'CHAT_ERROR',
    error,
    partialContent,
    videoId,
    ...(errorDetails !== undefined && { errorDetails }),
  };
}

/**
 * Initialize the chat port handler
 * Call this once when the service worker starts
 */
export function initChatHandler(
  getTranscriptForTab: (tabId: number, videoId: string) => Promise<TranscriptResponse>
): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAMES.CHAT_STREAM) return;

    log('Chat port connected');
    let abortController: AbortController | null = null;

    const sendMessage = (message: ChatPortResponse) => {
      try {
        port.postMessage(message);
      } catch (error) {
        logError('Failed to send chat message on port:', error);
      }
    };

    port.onMessage.addListener((message: ChatPortRequest) => {
      switch (message.type) {
        case 'CHAT_MESSAGE':
          abortController = new AbortController();

          // Start chat streaming (don't await - runs in background)
          void handleChatMessage(
            message.videoId,
            message.tabId,
            message.message,
            message.history,
            message.summary,
            message.modelId,
            sendMessage,
            abortController.signal,
            getTranscriptForTab
          );
          break;

        case 'CANCEL_CHAT':
          log('Cancel chat requested');
          abortController?.abort();
          break;

        case 'KEEPALIVE':
          sendMessage({ type: 'KEEPALIVE_ACK' });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      log('Chat port disconnected');
      abortController?.abort();
    });
  });
}

async function handleChatMessage(
  videoId: string,
  tabId: number,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  summary: string,
  modelId: string,
  sendMessage: (message: ChatPortResponse) => void,
  signal: AbortSignal,
  getTranscriptForTab: (tabId: number, videoId: string) => Promise<TranscriptResponse>
): Promise<void> {
  // 1. Check for API key
  const storage = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.CHAT_SYSTEM_PROMPT,
  ]);
  const openrouterApiKey = storage[STORAGE_KEYS.API_KEY] as string | undefined;

  if (!openrouterApiKey) {
    log('No API key configured');
    sendMessage(createChatError('NO_API_KEY', videoId));
    return;
  }

  // 2. Fetch transcript from the tab
  log('Fetching transcript for chat');
  const transcriptResponse = await getTranscriptForTab(tabId, videoId);
  if (transcriptResponse.type === 'TRANSCRIPT_ERROR') {
    log('Transcript error:', transcriptResponse.error);
    sendMessage(createChatError(transcriptResponse.error, videoId));
    return;
  }

  const transcript = transcriptResponse.transcript;

  // 3. Get chat system prompt (use custom or default)
  const chatSystemPrompt = (storage[STORAGE_KEYS.CHAT_SYSTEM_PROMPT] as string | undefined)
    ?? DEFAULT_CHAT_SYSTEM_PROMPT;

  // 4. Build messages array with system prompt, context, and history
  const systemContent = `${chatSystemPrompt}

## Video Summary
${summary}

## Full Transcript
${transcript}`;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage },
  ];

  // 5. Start streaming
  log('Starting chat stream');
  await streamChat({
    messages,
    apiKey: openrouterApiKey,
    model: modelId,
    callbacks: {
      onChunk: (content) => {
        sendMessage({ type: 'CHAT_CHUNK', content, videoId });
      },
      onComplete: (fullContent) => {
        sendMessage({
          type: 'CHAT_COMPLETE',
          videoId,
          fullContent,
        });
      },
      onError: (error, partialContent, errorDetails) => {
        sendMessage(createChatError(error, videoId, partialContent, errorDetails));
      },
    },
    signal,
  });
}
