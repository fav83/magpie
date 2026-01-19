import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChatMessage, VideoChat } from '../../types/chat';
import { useChatPort } from '../../hooks/useChatPort';
import {
  getVideoChat,
  saveVideoChat,
  clearVideoChat,
  generateMessageId,
} from '../../utils/chatStorage';

function createUserMessage(content: string): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'user',
    content: content.trim(),
    status: 'complete',
  };
}

function createStreamingAssistantMessage(): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content: '',
    status: 'streaming',
  };
}

function updateMessageInList(
  messages: ChatMessage[],
  messageId: string,
  updates: Partial<ChatMessage>
): ChatMessage[] {
  return messages.map((m) =>
    m.id === messageId ? { ...m, ...updates } : m
  );
}

function buildHistoryForApi(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => m.status === 'complete')
    .map((m) => ({ role: m.role, content: m.content }));
}

interface ReadonlyVideoChatProps {
  videoId: string;
  readonly: true;
  tabId?: never;
  summary?: never;
  modelId?: never;
}

interface InteractiveVideoChatProps {
  videoId: string;
  readonly?: false;
  tabId: number;
  summary: string;
  modelId: string;
}

export type UseVideoChatProps = ReadonlyVideoChatProps | InteractiveVideoChatProps;

interface UseVideoChatReturn {
  messages: ChatMessage[];
  isExpanded: boolean;
  isStreaming: boolean;
  streamingContent: string;
  sendMessage: (content: string) => void;
  cancelStreaming: () => void;
  clearChat: () => Promise<void>;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
}

export function useVideoChat(props: UseVideoChatProps): UseVideoChatReturn {
  const { videoId, readonly = false } = props;
  // For interactive mode, these are guaranteed by the type system
  const tabId = readonly ? undefined : props.tabId;
  const summary = readonly ? undefined : props.summary;
  const modelId = readonly ? undefined : props.modelId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const { startChat, cancelChat } = useChatPort();
  const streamingMessageIdRef = useRef<string | null>(null);

  // Load chat history from storage on mount or when videoId changes
  useEffect(() => {
    let mounted = true;

    async function loadChat() {
      const chat = await getVideoChat(videoId);
      if (mounted && chat) {
        setMessages(chat.messages);
        setIsExpanded(chat.isExpanded);
      }
    }

    void loadChat();

    return () => {
      mounted = false;
    };
  }, [videoId]);

  // Save chat state when messages or expansion state changes
  const saveChat = useCallback(
    async (newMessages: ChatMessage[], newIsExpanded: boolean) => {
      const chat: VideoChat = {
        videoId,
        messages: newMessages,
        isExpanded: newIsExpanded,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveVideoChat(chat);
    },
    [videoId]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (readonly || !content.trim() || isStreaming) return;
      if (tabId === undefined || summary === undefined || modelId === undefined) return;

      const userMessage = createUserMessage(content);
      const assistantMessage = createStreamingAssistantMessage();
      const assistantMessageId = assistantMessage.id;
      streamingMessageIdRef.current = assistantMessageId;

      // Add both messages to state and save
      setMessages((prev) => {
        const newMessages = [...prev, userMessage, assistantMessage];
        void saveChat(newMessages, true);
        return newMessages;
      });

      setIsStreaming(true);
      setStreamingContent('');
      setIsExpanded(true);

      const history = buildHistoryForApi(messages);

      startChat(videoId, tabId, content.trim(), history, summary, modelId, {
        onChunk: (chunk) => {
          setStreamingContent((prev) => prev + chunk.content);
        },
        onComplete: (complete) => {
          setIsStreaming(false);
          setStreamingContent('');
          streamingMessageIdRef.current = null;

          setMessages((prev) => {
            const newMessages = updateMessageInList(prev, assistantMessageId, {
              content: complete.fullContent,
              status: 'complete',
            });
            void saveChat(newMessages, true);
            return newMessages;
          });
        },
        onError: (error) => {
          setIsStreaming(false);
          streamingMessageIdRef.current = null;

          setMessages((prev) => {
            const newMessages = updateMessageInList(prev, assistantMessageId, {
              content: streamingContent || (error.partialContent ?? ''),
              status: 'error',
              error: error.errorDetails ?? error.error,
            });
            void saveChat(newMessages, true);
            return newMessages;
          });
        },
      });
    },
    [readonly, isStreaming, messages, videoId, tabId, summary, modelId, startChat, saveChat, streamingContent]
  );

  const cancelStreaming = useCallback(() => {
    cancelChat();
  }, [cancelChat]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    setStreamingContent('');
    setIsStreaming(false);
    streamingMessageIdRef.current = null;
    await clearVideoChat(videoId);
  }, [videoId]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const newExpanded = !prev;
      void saveChat(messages, newExpanded);
      return newExpanded;
    });
  }, [messages, saveChat]);

  const setExpanded = useCallback(
    (expanded: boolean) => {
      setIsExpanded(expanded);
      void saveChat(messages, expanded);
    },
    [messages, saveChat]
  );

  return {
    messages,
    isExpanded,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStreaming,
    clearChat,
    toggleExpanded,
    setExpanded,
  };
}
