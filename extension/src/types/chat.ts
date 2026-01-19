/**
 * Represents a single chat message
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'streaming' | 'error';
  error?: string;
}

/**
 * Represents the chat state for a specific video
 */
export interface VideoChat {
  videoId: string;
  messages: ChatMessage[];
  isExpanded: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Storage schema for all video chats
 */
export type VideoChatStorage = Record<string, VideoChat>;
