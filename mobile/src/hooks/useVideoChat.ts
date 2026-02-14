import { useState, useRef, useCallback } from 'react';
import type { ChatMessage } from '../types/chat';
import { streamChat } from '../services/streamingChat';
import { getErrorMessage } from '../services/errorMessages';
import { useBufferedMarkdown } from './useBufferedMarkdown';
import { StreamAbortedError } from '../services/sseParser';

let nextId = 0;
function generateMessageId(): string {
  return `msg-${Date.now()}-${nextId++}`;
}

interface UseVideoChatParams {
  apiKey: string | null;
  model: string;
  summary: string;
  transcript: string;
}

interface UseVideoChatReturn {
  messages: ChatMessage[];
  isExpanded: boolean;
  isStreaming: boolean;
  streamingDisplayContent: string;
  sendMessage: (content: string) => void;
  cancelStreaming: () => void;
  clearChat: () => void;
  toggleExpanded: () => void;
  reset: () => void;
}

export function useVideoChat({ apiKey, model, summary, transcript }: UseVideoChatParams): UseVideoChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const bufferedMarkdown = useBufferedMarkdown();

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isStreaming || !apiKey) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: trimmed,
      status: 'complete',
    };

    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      status: 'streaming',
    };

    const assistantId = assistantMessage.id;

    // Build history from existing complete messages
    const history = messages
      .filter((m) => m.status === 'complete')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);
    setIsExpanded(true);
    bufferedMarkdown.reset();

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    stopRef.current = false;

    void streamChat({
      history,
      userMessage: trimmed,
      summary,
      transcript,
      apiKey,
      model,
      callbacks: {
        onChunk: (chunk) => {
          bufferedMarkdown.appendChunk(chunk);
        },
        onComplete: (fullContent) => {
          bufferedMarkdown.flush();
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: fullContent, status: 'complete' as const } : m),
          );
        },
        onError: (error, partialContent, errorDetails) => {
          bufferedMarkdown.flush();
          setIsStreaming(false);
          const finalContent = partialContent ?? bufferedMarkdown.getFullContent();
          const baseMessage = getErrorMessage(error, 'Failed to get response.');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: finalContent || '',
                    status: 'error' as const,
                    error: errorDetails ? `${baseMessage} (${errorDetails})` : baseMessage,
                  }
                : m,
            ),
          );
        },
      },
      signal: controller.signal,
    }).catch((error: unknown) => {
      // Abort errors
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'StreamAbortedError') ||
        error instanceof StreamAbortedError
      ) {
        bufferedMarkdown.flush();
        const partialContent = bufferedMarkdown.getFullContent();
        setIsStreaming(false);

        if (stopRef.current && partialContent) {
          // User pressed stop — preserve partial content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: partialContent, status: 'error' as const, error: '(incomplete)' }
                : m,
            ),
          );
        } else if (stopRef.current) {
          // User stopped but no content yet — remove the empty assistant message
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
        // If not stopRef (reset collision), the reset() call already cleared messages
        return;
      }

      // Unexpected error
      if (!controller.signal.aborted) {
        bufferedMarkdown.flush();
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '', status: 'error' as const, error: getErrorMessage('API_ERROR') }
              : m,
          ),
        );
      }
    });
  }, [isStreaming, apiKey, messages, summary, transcript, model, bufferedMarkdown]);

  const cancelStreaming = useCallback(() => {
    stopRef.current = true;
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
    bufferedMarkdown.reset();
    abortRef.current?.abort();
  }, [bufferedMarkdown]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    stopRef.current = false;
    abortRef.current?.abort();
    setMessages([]);
    setIsExpanded(false);
    setIsStreaming(false);
    bufferedMarkdown.reset();
  }, [bufferedMarkdown]);

  return {
    messages,
    isExpanded,
    isStreaming,
    streamingDisplayContent: bufferedMarkdown.displayContent,
    sendMessage,
    cancelStreaming,
    clearChat,
    toggleExpanded,
    reset,
  };
}
