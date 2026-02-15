import { Share } from '@capacitor/share';
import { logError } from '../utils/logger';
import { formatChatForShare } from '../utils/formatChat';
import type { ChatMessage } from '../types/chat';

export interface ShareContent {
  title: string;
  summary: string;
  url: string;
  model: string;
}

export function formatShareText(content: ShareContent): string {
  return `**Title:** ${content.title}\n**URL:** ${content.url}\n**Model:** ${content.model}\n\n${content.summary}`;
}

export function formatShareWithChatText(content: ShareContent, messages: ChatMessage[]): string {
  return `${formatShareText(content)}\n\n---\n\n**Chat:**\n\n${formatChatForShare(messages)}`;
}

export async function shareSummary(content: ShareContent): Promise<void> {
  try {
    await Share.share({
      title: content.title,
      text: formatShareText(content),
      dialogTitle: 'Share Summary',
    });
  } catch (error) {
    logError('shareSummary:share', error);
  }
}

export async function copySummary(content: ShareContent): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatShareText(content));
    return true;
  } catch (error) {
    logError('shareSummary:copy', error);
    return false;
  }
}

export async function shareWithChat(content: ShareContent, messages: ChatMessage[]): Promise<void> {
  try {
    await Share.share({
      title: content.title,
      text: formatShareWithChatText(content, messages),
      dialogTitle: 'Share Summary & Chat',
    });
  } catch (error) {
    logError('shareSummary:shareWithChat', error);
  }
}
