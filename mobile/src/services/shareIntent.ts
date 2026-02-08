import { SendIntent } from 'send-intent';
import { extractYouTubeUrl } from '../utils/youtube';

export type ShareIntentResult =
  | { kind: 'youtube'; url: string }
  | { kind: 'no-youtube' }
  | { kind: 'none' };

export async function checkShareIntent(): Promise<ShareIntentResult> {
  try {
    const result = await SendIntent.checkSendIntentReceived();
    if (result?.url) {
      const youtubeUrl = extractYouTubeUrl(result.url);
      return youtubeUrl ? { kind: 'youtube', url: youtubeUrl } : { kind: 'no-youtube' };
    }
    return { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}
