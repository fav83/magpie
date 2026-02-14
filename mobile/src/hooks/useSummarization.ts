import { useState, useRef, useCallback } from 'react';
import { isValidYouTubeUrl, extractVideoId } from '../utils/youtube';
import { fetchTranscript } from '../services/transcript';
import { streamSummary } from '../services/streamingOpenrouter';
import { getPromptById } from '../services/promptStorage';
import { useBufferedMarkdown } from './useBufferedMarkdown';
import { config } from '../config';

export interface SummaryResult {
  summary: string;
  title: string;
  url: string;
}

export type SummarizationState = 'idle' | 'fetching-transcript' | 'streaming' | 'done' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL: 'Please enter a valid YouTube video URL',
  NO_CAPTIONS: 'No transcript available for this video',
  CONTEXT_TOO_LONG: 'This video is too long for the current model. Try a shorter video.',
  EXTRACTION_FAILED: 'Failed to extract transcript. Please try again.',
  API_ERROR: 'Failed to generate summary. Please try again.',
  NETWORK_ERROR: 'No internet connection. Please check your network.',
  INVALID_API_KEY: 'Failed to generate summary. Please try again.',
  RATE_LIMITED: 'Rate limited. Please try again later.',
};

function validateUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!isValidYouTubeUrl(trimmed)) return null;
  return extractVideoId(trimmed) || null;
}

interface UseSummarizationParams {
  url: string;
  apiKey: string | null;
  selectedPromptId: string | null;
  modelOverride?: string | null;
}

export function useSummarization({ url, apiKey, selectedPromptId, modelOverride }: UseSummarizationParams) {
  const [state, setState] = useState<SummarizationState>('idle');
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [noKeyError, setNoKeyError] = useState(false);
  const [hasReceivedFirstChunk, setHasReceivedFirstChunk] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const titleRef = useRef('');
  const targetUrlRef = useRef('');

  const bufferedMarkdown = useBufferedMarkdown();

  const handleSummarize = useCallback(async (urlOverride?: string) => {
    if (!apiKey) {
      setNoKeyError(true);
      setErrorMessage('API key not configured.');
      return;
    }
    setNoKeyError(false);

    const videoId = validateUrl((urlOverride ?? url).trim());
    if (!videoId) {
      setErrorMessage(ERROR_MESSAGES.INVALID_URL ?? 'Invalid URL');
      return;
    }

    // Get the selected prompt
    const prompt = selectedPromptId ? await getPromptById(selectedPromptId) : null;
    const promptText = prompt?.text ?? '{{transcript}}';
    const model = modelOverride ?? prompt?.model ?? config.defaultModel;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    stopRef.current = false;

    // Reset state
    setSummaryResult(null);
    setErrorMessage('');
    setHasReceivedFirstChunk(false);
    bufferedMarkdown.reset();

    const targetUrl = (urlOverride ?? url).trim();
    targetUrlRef.current = targetUrl;

    // Phase 1: Fetch transcript
    setState('fetching-transcript');

    const transcriptResult = await fetchTranscript(videoId, controller.signal);
    if (!transcriptResult.success) {
      if (controller.signal.aborted) return;
      setState('error');
      setErrorMessage(ERROR_MESSAGES[transcriptResult.error] ?? 'Failed to extract transcript.');
      return;
    }

    if (transcriptResult.data.transcript.length > config.maxTranscriptChars) {
      setState('error');
      setErrorMessage(ERROR_MESSAGES.CONTEXT_TOO_LONG ?? 'Transcript too long');
      return;
    }

    titleRef.current = transcriptResult.data.title;

    // Phase 2: Stream summary
    setState('streaming');

    try {
      await streamSummary({
        transcript: transcriptResult.data.transcript,
        apiKey,
        promptText,
        model,
        signal: controller.signal,
        callbacks: {
          onChunk: (content) => {
            setHasReceivedFirstChunk(true);
            bufferedMarkdown.appendChunk(content);
          },
          onComplete: (fullContent) => {
            bufferedMarkdown.flush();
            setSummaryResult({
              summary: fullContent,
              title: titleRef.current,
              url: targetUrlRef.current,
            });
            setState('done');
          },
          onError: (error, partialContent, errorDetails) => {
            bufferedMarkdown.flush();
            if (partialContent) {
              setSummaryResult({
                summary: partialContent,
                title: titleRef.current,
                url: targetUrlRef.current,
              });
            }
            setState('error');
            const baseMessage = ERROR_MESSAGES[error] ?? 'Failed to generate summary.';
            setErrorMessage(errorDetails ? `${baseMessage} (${errorDetails})` : baseMessage);
          },
        },
      });
    } catch (error) {
      // Abort errors (user stop or share collision)
      if (
        error instanceof DOMException && error.name === 'AbortError' ||
        (error instanceof Error && error.name === 'StreamAbortedError')
      ) {
        if (stopRef.current) {
          // User pressed stop — treat partial content as done
          bufferedMarkdown.flush();
          const partialContent = bufferedMarkdown.getFullContent();
          if (partialContent) {
            const stoppedContent = partialContent + '\n\n---\n*Summary stopped by user*';
            setSummaryResult({
              summary: stoppedContent,
              title: titleRef.current,
              url: targetUrlRef.current,
            });
          }
          setState('done');
        }
        // If not stopRef (share collision), caller already reset state — just return
        return;
      }

      // Unexpected error
      if (!controller.signal.aborted) {
        bufferedMarkdown.flush();
        setState('error');
        setErrorMessage(ERROR_MESSAGES.API_ERROR ?? 'Failed to generate summary.');
      }
    }
  }, [url, apiKey, selectedPromptId, modelOverride, bufferedMarkdown]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    abortRef.current?.abort();
  }, []);

  const cancel = useCallback(() => {
    stopRef.current = false;
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setSummaryResult(null);
    setErrorMessage('');
    setNoKeyError(false);
    setHasReceivedFirstChunk(false);
    bufferedMarkdown.reset();
  }, [bufferedMarkdown]);

  return {
    state,
    summaryResult,
    displayContent: bufferedMarkdown.displayContent,
    errorMessage,
    setErrorMessage,
    noKeyError,
    hasReceivedFirstChunk,
    handleSummarize,
    handleStop,
    cancel,
    reset,
  };
}
