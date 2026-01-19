import type { VideoChat, VideoChatStorage, ChatMessage } from '../types/chat';
import { STORAGE_KEYS } from '../config';

async function getAllChats(): Promise<VideoChatStorage> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.VIDEO_CHATS]);
  return (result[STORAGE_KEYS.VIDEO_CHATS] as VideoChatStorage | undefined) ?? {};
}

async function saveAllChats(chats: VideoChatStorage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.VIDEO_CHATS]: chats });
}

export async function getVideoChat(videoId: string): Promise<VideoChat | null> {
  const chats = await getAllChats();
  return chats[videoId] ?? null;
}

export async function saveVideoChat(chat: VideoChat): Promise<void> {
  const chats = await getAllChats();
  chats[chat.videoId] = {
    ...chat,
    updatedAt: Date.now(),
  };
  await saveAllChats(chats);
}

export async function clearVideoChat(videoId: string): Promise<void> {
  const chats = await getAllChats();
  const remainingChats = Object.fromEntries(
    Object.entries(chats).filter(([key]) => key !== videoId)
  ) as VideoChatStorage;
  await saveAllChats(remainingChats);
}

export async function addMessageToChat(
  videoId: string,
  message: ChatMessage
): Promise<VideoChat> {
  const existingChat = await getVideoChat(videoId);
  const now = Date.now();

  const chat: VideoChat = existingChat ?? {
    videoId,
    messages: [],
    isExpanded: true,
    createdAt: now,
    updatedAt: now,
  };

  chat.messages.push(message);
  chat.updatedAt = now;

  await saveVideoChat(chat);
  return chat;
}

export async function updateLastMessage(
  videoId: string,
  updates: Partial<ChatMessage>
): Promise<VideoChat | null> {
  const chat = await getVideoChat(videoId);
  if (!chat || chat.messages.length === 0) return null;

  const lastIndex = chat.messages.length - 1;
  const currentMessage = chat.messages[lastIndex];
  if (!currentMessage) return null;

  // Merge updates with current message
  chat.messages[lastIndex] = {
    ...currentMessage,
    ...updates,
  };

  chat.updatedAt = Date.now();
  await saveVideoChat(chat);
  return chat;
}

export async function setChatExpanded(
  videoId: string,
  isExpanded: boolean
): Promise<void> {
  const chat = await getVideoChat(videoId);
  if (chat) {
    chat.isExpanded = isExpanded;
    await saveVideoChat(chat);
  }
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
