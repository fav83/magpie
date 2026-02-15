import type { ChatMessage } from '../types/chat';

/** Format chat messages for plain-text copy (no markdown bold) */
export function formatChatConversation(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

/** Format chat messages for share text (with markdown bold) */
export function formatChatForShare(messages: ChatMessage[]): string {
  return messages
    .map((m) => `**${m.role === 'user' ? 'You' : 'Assistant'}:** ${m.content}`)
    .join('\n\n');
}
