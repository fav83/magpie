import { Share } from '@capacitor/share';
import { logError } from '../utils/logger';

export interface ShareContent {
  title: string;
  summary: string;
  url: string;
}

export function formatShareText(content: ShareContent): string {
  return `${content.title}\n\n${content.summary}\n\n${content.url}`;
}

export async function shareSummary(content: ShareContent): Promise<void> {
  try {
    await Share.share({
      title: content.title,
      text: content.summary,
      url: content.url,
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
