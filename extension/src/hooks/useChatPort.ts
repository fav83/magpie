import { useRef, useCallback, useEffect } from 'react';
import type {
  ChatPortRequest,
  ChatPortResponse,
  ChatChunk,
  ChatComplete,
  ChatError,
} from '../types/messages';
import { PORT_NAMES } from '../config';

export interface ChatStreamingCallbacks {
  onChunk: (chunk: ChatChunk) => void;
  onComplete: (complete: ChatComplete) => void;
  onError: (error: ChatError) => void;
}

interface UseChatPortReturn {
  startChat: (
    videoId: string,
    tabId: number,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    summary: string,
    modelId: string,
    callbacks: ChatStreamingCallbacks
  ) => void;
  cancelChat: () => void;
  isConnected: boolean;
}

export function useChatPort(): UseChatPortReturn {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const callbacksRef = useRef<ChatStreamingCallbacks | null>(null);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      portRef.current?.disconnect();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (portRef.current) {
      portRef.current.disconnect();
      portRef.current = null;
    }
    callbacksRef.current = null;
  }, []);

  const startChat = useCallback(
    (
      videoId: string,
      tabId: number,
      message: string,
      history: { role: 'user' | 'assistant'; content: string }[],
      summary: string,
      modelId: string,
      callbacks: ChatStreamingCallbacks
    ) => {
      // Disconnect any existing connection
      disconnect();

      // Store callbacks
      callbacksRef.current = callbacks;

      // Create new port connection
      const port = chrome.runtime.connect({ name: PORT_NAMES.CHAT_STREAM });
      portRef.current = port;

      // Set up message listener
      port.onMessage.addListener((response: ChatPortResponse) => {
        const currentCallbacks = callbacksRef.current;
        if (!currentCallbacks) return;

        switch (response.type) {
          case 'CHAT_CHUNK':
            currentCallbacks.onChunk(response);
            break;
          case 'CHAT_COMPLETE':
            currentCallbacks.onComplete(response);
            disconnect();
            break;
          case 'CHAT_ERROR':
            currentCallbacks.onError(response);
            disconnect();
            break;
          case 'KEEPALIVE_ACK':
            // Keep-alive acknowledged, nothing to do
            break;
        }
      });

      // Handle disconnection
      port.onDisconnect.addListener(() => {
        // If we still have callbacks, this was an unexpected disconnect
        if (callbacksRef.current) {
          callbacksRef.current.onError({
            type: 'CHAT_ERROR',
            error: 'Connection lost',
            partialContent: null,
            videoId,
          });
        }
        disconnect();
      });

      // Start keep-alive pings to prevent service worker termination
      keepAliveIntervalRef.current = setInterval(() => {
        if (portRef.current) {
          try {
            portRef.current.postMessage({ type: 'KEEPALIVE' } as ChatPortRequest);
          } catch {
            // Port may have disconnected
          }
        }
      }, 20000); // Every 20 seconds

      // Send the chat request
      const request: ChatPortRequest = {
        type: 'CHAT_MESSAGE',
        videoId,
        tabId,
        message,
        history,
        summary,
        modelId,
      };
      port.postMessage(request);
    },
    [disconnect]
  );

  const cancelChat = useCallback(() => {
    if (portRef.current) {
      try {
        portRef.current.postMessage({ type: 'CANCEL_CHAT' } as ChatPortRequest);
      } catch {
        // Port may have disconnected
      }
    }
  }, []);

  return {
    startChat,
    cancelChat,
    isConnected: portRef.current !== null,
  };
}
