import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVideoChat,
  saveVideoChat,
  clearVideoChat,
  addMessageToChat,
  updateLastMessage,
  setChatExpanded,
  generateMessageId,
} from '../../src/utils/chatStorage';
import type { VideoChat, ChatMessage } from '../../src/types/chat';
import { STORAGE_KEYS } from '../../src/config';
import { setupChromeMock, resetChromeMock, chromeMock } from '../mocks/chrome';

describe('chatStorage', () => {
  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
  });

  const createMockMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
    id: 'msg_123',
    role: 'user',
    content: 'Hello',
    status: 'complete',
    ...overrides,
  });

  const createMockChat = (overrides?: Partial<VideoChat>): VideoChat => ({
    videoId: 'video123',
    messages: [],
    isExpanded: true,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  });

  describe('getVideoChat', () => {
    it('should return null when no chat exists', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      const result = await getVideoChat('nonexistent');

      expect(result).toBeNull();
    });

    it('should return chat when it exists', async () => {
      const mockChat = createMockChat();
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: mockChat },
      });

      const result = await getVideoChat('video123');

      expect(result).toEqual(mockChat);
    });
  });

  describe('saveVideoChat', () => {
    it('should save chat to storage with updated timestamp', async () => {
      const mockChat = createMockChat();
      chromeMock.storage.local.get.mockResolvedValue({});

      await saveVideoChat(mockChat);

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VIDEO_CHATS]: {
          video123: expect.objectContaining({
            videoId: 'video123',
            updatedAt: expect.any(Number),
          }),
        },
      });
    });

    it('should preserve existing chats when saving', async () => {
      const existingChat = createMockChat({ videoId: 'existing' });
      const newChat = createMockChat({ videoId: 'new' });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { existing: existingChat },
      });

      await saveVideoChat(newChat);

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VIDEO_CHATS]: expect.objectContaining({
          existing: existingChat,
          new: expect.objectContaining({ videoId: 'new' }),
        }),
      });
    });
  });

  describe('clearVideoChat', () => {
    it('should remove chat from storage', async () => {
      const mockChat = createMockChat();
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: mockChat },
      });

      await clearVideoChat('video123');

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VIDEO_CHATS]: {},
      });
    });

    it('should not affect other chats', async () => {
      const chat1 = createMockChat({ videoId: 'video1' });
      const chat2 = createMockChat({ videoId: 'video2' });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video1: chat1, video2: chat2 },
      });

      await clearVideoChat('video1');

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VIDEO_CHATS]: { video2: chat2 },
      });
    });
  });

  describe('addMessageToChat', () => {
    it('should create new chat if none exists', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});
      const message = createMockMessage();

      const result = await addMessageToChat('newVideo', message);

      expect(result.videoId).toBe('newVideo');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual(message);
      expect(result.isExpanded).toBe(true);
    });

    it('should add message to existing chat', async () => {
      const existingMessage = createMockMessage({ id: 'msg_1', content: 'First' });
      const existingChat = createMockChat({ messages: [existingMessage] });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: existingChat },
      });

      const newMessage = createMockMessage({ id: 'msg_2', content: 'Second' });
      const result = await addMessageToChat('video123', newMessage);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]).toEqual(newMessage);
    });
  });

  describe('updateLastMessage', () => {
    it('should return null when no chat exists', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      const result = await updateLastMessage('nonexistent', { content: 'Updated' });

      expect(result).toBeNull();
    });

    it('should return null when chat has no messages', async () => {
      const emptyChat = createMockChat({ messages: [] });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: emptyChat },
      });

      const result = await updateLastMessage('video123', { content: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update last message content', async () => {
      const message = createMockMessage({ content: 'Original' });
      const chat = createMockChat({ messages: [message] });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: chat },
      });

      const result = await updateLastMessage('video123', { content: 'Updated' });

      expect(result?.messages[0]?.content).toBe('Updated');
    });

    it('should update last message status', async () => {
      const message = createMockMessage({ status: 'streaming' });
      const chat = createMockChat({ messages: [message] });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: chat },
      });

      const result = await updateLastMessage('video123', { status: 'complete' });

      expect(result?.messages[0]?.status).toBe('complete');
    });

    it('should add error field when provided', async () => {
      const message = createMockMessage({ status: 'streaming' });
      const chat = createMockChat({ messages: [message] });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: chat },
      });

      const result = await updateLastMessage('video123', {
        status: 'error',
        error: 'Something went wrong'
      });

      expect(result?.messages[0]?.status).toBe('error');
      expect(result?.messages[0]?.error).toBe('Something went wrong');
    });

    it('should not update fields with undefined values', async () => {
      const message = createMockMessage({ content: 'Original', status: 'complete' });
      const chat = createMockChat({ messages: [message] });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: chat },
      });

      const result = await updateLastMessage('video123', { status: 'error' });

      expect(result?.messages[0]?.content).toBe('Original');
      expect(result?.messages[0]?.status).toBe('error');
    });
  });

  describe('setChatExpanded', () => {
    it('should update isExpanded when chat exists', async () => {
      const chat = createMockChat({ isExpanded: true });
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.VIDEO_CHATS]: { video123: chat },
      });

      await setChatExpanded('video123', false);

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.VIDEO_CHATS]: expect.objectContaining({
          video123: expect.objectContaining({ isExpanded: false }),
        }),
      });
    });

    it('should do nothing when chat does not exist', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      await setChatExpanded('nonexistent', true);

      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('generateMessageId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).not.toBe(id2);
    });

    it('should start with msg_ prefix', () => {
      const id = generateMessageId();

      expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });
  });
});
