import { useEffect, useRef, useCallback, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { checkShareIntent } from '../services/shareIntent';

interface UseShareIntentParams {
  onYouTubeUrl: (url: string) => void;
  onNoYouTube: () => void;
}

export function useShareIntent({ onYouTubeUrl, onNoYouTube }: UseShareIntentParams) {
  const [pendingShareUrl, setPendingShareUrl] = useState<string | null>(null);
  const onYouTubeUrlRef = useRef(onYouTubeUrl);
  const onNoYouTubeRef = useRef(onNoYouTube);
  onYouTubeUrlRef.current = onYouTubeUrl;
  onNoYouTubeRef.current = onNoYouTube;

  useEffect(() => {
    const processIntent = async (retryOnNone = true) => {
      const result = await checkShareIntent();
      if (result.kind === 'youtube') {
        onYouTubeUrlRef.current(result.url);
        setPendingShareUrl(result.url);
      } else if (result.kind === 'no-youtube') {
        onNoYouTubeRef.current();
      } else if (retryOnNone) {
        // Bridge may not be ready on cold start; retry once
        setTimeout(() => void processIntent(false), 500);
      }
    };

    void processIntent();

    const listener = CapApp.addListener('resume', () => {
      void processIntent(false);
    });
    return () => { void listener.then((l) => l.remove()); };
  }, []);

  const consumePendingUrl = useCallback(() => {
    const url = pendingShareUrl;
    if (url) setPendingShareUrl(null);
    return url;
  }, [pendingShareUrl]);

  return { pendingShareUrl, consumePendingUrl };
}
