import { useRef, useCallback, useEffect } from 'react';
import type {
  StreamPortRequest,
  StreamPortResponse,
  StreamChunk,
  StreamComplete,
  StreamError,
} from '../types/messages';
import { PORT_NAMES } from '../config';
import { log, logComponent, logError } from '../utils/logger';

const STREAM_LOG = 'StreamingPort';

// Keepalive configuration
const KEEPALIVE_INTERVAL_MS = 15000; // 15 seconds - well under service worker 30s timeout
const KEEPALIVE_TIMEOUT_MS = 5000; // Consider connection unhealthy if no ack within 5s
const MAX_MISSED_KEEPALIVES = 2; // Disconnect after 2 missed keepalives

export interface StreamingCallbacks {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: (complete: StreamComplete) => void;
  onError: (error: StreamError) => void;
}

interface UseStreamingPortReturn {
  startStream: (
    videoId: string,
    promptId: string,
    modelId: string,
    tabId: number,
    callbacks: StreamingCallbacks,
    customPromptText?: string
  ) => void;
  cancelStream: () => void;
  isConnected: boolean;
}

export function useStreamingPort(): UseStreamingPortReturn {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const callbacksRef = useRef<StreamingCallbacks | null>(null);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missedKeepalivesRef = useRef(0);
  const currentRequestRef = useRef<{ videoId: string; promptId: string } | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      if (keepAliveTimeoutRef.current) {
        clearTimeout(keepAliveTimeoutRef.current);
      }
      portRef.current?.disconnect();
    };
  }, []);

  const disconnect = useCallback(() => {
    logComponent(STREAM_LOG, 'Disconnecting port...');
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (keepAliveTimeoutRef.current) {
      clearTimeout(keepAliveTimeoutRef.current);
      keepAliveTimeoutRef.current = null;
    }
    if (portRef.current) {
      portRef.current.disconnect();
      portRef.current = null;
    }
    callbacksRef.current = null;
    currentRequestRef.current = null;
    missedKeepalivesRef.current = 0;
    logComponent(STREAM_LOG, 'Port disconnected');
  }, []);

  const startStream = useCallback(
    (
      videoId: string,
      promptId: string,
      modelId: string,
      tabId: number,
      callbacks: StreamingCallbacks,
      customPromptText?: string
    ) => {
      const streamStartTime = Date.now();
      logComponent(STREAM_LOG, 'Starting stream:', {
        videoId,
        promptId,
        modelId,
        tabId,
        hasCustomPrompt: !!customPromptText,
      });

      // Disconnect any existing connection
      disconnect();

      // Store callbacks and current request info
      callbacksRef.current = callbacks;
      currentRequestRef.current = { videoId, promptId };

      // Create new port connection
      logComponent(STREAM_LOG, 'Creating port connection...');
      const port = chrome.runtime.connect({ name: PORT_NAMES.SUMMARY_STREAM });
      portRef.current = port;
      logComponent(STREAM_LOG, 'Port connected');

      // Helper to handle connection loss
      const handleConnectionLoss = () => {
        const request = currentRequestRef.current;
        logError('Stream connection lost', { videoId: request?.videoId, promptId: request?.promptId });
        if (callbacksRef.current && request) {
          callbacksRef.current.onError({
            type: 'STREAM_ERROR',
            error: 'Connection lost',
            partialContent: null,
            videoId: request.videoId,
            promptId: request.promptId,
          });
        }
        disconnect();
      };

      let chunkCount = 0;
      let totalChars = 0;

      // Set up message listener
      port.onMessage.addListener((message: StreamPortResponse) => {
        const currentCallbacks = callbacksRef.current;
        if (!currentCallbacks) return;

        switch (message.type) {
          case 'STREAM_CHUNK':
            chunkCount++;
            totalChars += message.content.length;
            if (chunkCount % 10 === 0) {
              logComponent(STREAM_LOG, `Received ${chunkCount} chunks, ${totalChars} chars total`);
            }
            currentCallbacks.onChunk(message);
            break;
          case 'STREAM_COMPLETE':
            logComponent(STREAM_LOG, 'Stream complete:', {
              videoId: message.videoId,
              totalChunks: chunkCount,
              totalChars: message.fullContent.length,
              durationMs: Date.now() - streamStartTime,
            });
            currentCallbacks.onComplete(message);
            disconnect();
            break;
          case 'STREAM_ERROR':
            // Use log instead of logError for expected errors like NO_CAPTIONS
            log(`Stream ended with error: ${message.error}`, {
              videoId: message.videoId,
              chunksReceived: chunkCount,
              durationMs: Date.now() - streamStartTime,
            });
            currentCallbacks.onError(message);
            disconnect();
            break;
          case 'KEEPALIVE_ACK':
            // Reset missed keepalives counter and clear timeout
            missedKeepalivesRef.current = 0;
            if (keepAliveTimeoutRef.current) {
              clearTimeout(keepAliveTimeoutRef.current);
              keepAliveTimeoutRef.current = null;
            }
            break;
        }
      });

      // Handle disconnection
      port.onDisconnect.addListener(() => {
        logComponent(STREAM_LOG, 'Port disconnected event, hasCallbacks:', !!callbacksRef.current);
        // If we still have callbacks, this was an unexpected disconnect
        if (callbacksRef.current) {
          handleConnectionLoss();
        } else {
          disconnect();
        }
      });

      // Send keepalive with timeout monitoring
      const sendKeepalive = () => {
        if (!portRef.current) return;

        try {
          portRef.current.postMessage({ type: 'KEEPALIVE' } as StreamPortRequest);

          // Set timeout to detect if ack is not received
          keepAliveTimeoutRef.current = setTimeout(() => {
            missedKeepalivesRef.current++;
            logComponent(STREAM_LOG, `Missed keepalive ${missedKeepalivesRef.current}/${MAX_MISSED_KEEPALIVES}`);
            if (missedKeepalivesRef.current >= MAX_MISSED_KEEPALIVES) {
              // Too many missed keepalives - connection is likely dead
              logError('Too many missed keepalives, treating connection as dead');
              handleConnectionLoss();
            }
          }, KEEPALIVE_TIMEOUT_MS);
        } catch (e) {
          // Port may have disconnected
          logError('Failed to send keepalive:', e);
          handleConnectionLoss();
        }
      };

      // Start keep-alive pings to prevent service worker termination
      keepAliveIntervalRef.current = setInterval(sendKeepalive, KEEPALIVE_INTERVAL_MS);

      // Send the stream request
      const request: StreamPortRequest = {
        type: 'STREAM_SUMMARY',
        videoId,
        promptId,
        modelId,
        tabId,
        ...(customPromptText !== undefined && { customPromptText }),
      };
      logComponent(STREAM_LOG, 'Sending stream request');
      port.postMessage(request);
    },
    [disconnect]
  );

  const cancelStream = useCallback(() => {
    if (portRef.current) {
      try {
        portRef.current.postMessage({ type: 'CANCEL_STREAM' } as StreamPortRequest);
      } catch {
        // Port may have disconnected
      }
    }
  }, []);

  return {
    startStream,
    cancelStream,
    isConnected: portRef.current !== null,
  };
}
