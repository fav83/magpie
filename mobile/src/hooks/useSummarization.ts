import { useState, useRef, useCallback } from 'react';
import { isValidYouTubeUrl, extractVideoId } from '../utils/youtube';
import { fetchTranscript } from '../services/transcript';
import { streamSummary } from '../services/streamingOpenrouter';
import { getPromptById } from '../services/promptStorage';
import { getErrorMessage } from '../services/errorMessages';
import { useBufferedMarkdown } from './useBufferedMarkdown';
import { config } from '../config';

export interface SummaryResult {
  summary: string;
  title: string;
  url: string;
  model: string;
  transcript: string;
}

export type SummarizationState = 'idle' | 'fetching-transcript' | 'streaming' | 'done' | 'error';

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
  const contextRef = useRef({ title: '', url: '', model: '', transcript: '' });

  const bufferedMarkdown = useBufferedMarkdown();

  const makeSummaryResult = (summary: string): SummaryResult => ({
    summary,
    title: contextRef.current.title,
    url: contextRef.current.url,
    model: contextRef.current.model,
    transcript: contextRef.current.transcript,
  });

  const handleSummarize = useCallback(async (urlOverride?: string) => {
    if (!apiKey) {
      setNoKeyError(true);
      setErrorMessage('API key not configured.');
      return;
    }
    setNoKeyError(false);

    const videoId = validateUrl((urlOverride ?? url).trim());
    if (!videoId) {
      setErrorMessage(getErrorMessage('INVALID_URL'));
      return;
    }

    // Get the selected prompt
    const prompt = selectedPromptId ? await getPromptById(selectedPromptId) : null;
    const promptText = prompt?.text ?? '{{transcript}}';
    const model = modelOverride ?? prompt?.model ?? config.defaultModel;
    contextRef.current.model = model;

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

    contextRef.current.url = (urlOverride ?? url).trim();

    // Phase 1: Fetch transcript
    setState('fetching-transcript');

    const transcriptResult = await fetchTranscript(videoId, controller.signal);
    if (!transcriptResult.success) {
      if (controller.signal.aborted) return;
      setState('error');
      setErrorMessage(getErrorMessage(transcriptResult.error, 'Failed to extract transcript.'));
      return;
    }

    if (transcriptResult.data.transcript.length > config.maxTranscriptChars) {
      setState('error');
      setErrorMessage(getErrorMessage('CONTEXT_TOO_LONG'));
      return;
    }

    contextRef.current.title = transcriptResult.data.title;
    contextRef.current.transcript = transcriptResult.data.transcript;

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
            setSummaryResult(makeSummaryResult(fullContent));
            setState('done');
          },
          onError: (error, partialContent, errorDetails) => {
            bufferedMarkdown.flush();
            if (partialContent) {
              setSummaryResult(makeSummaryResult(partialContent));
            }
            setState('error');
            const baseMessage = getErrorMessage(error, 'Failed to generate summary.');
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
            setSummaryResult(makeSummaryResult(partialContent + '\n\n---\n*Summary stopped by user*'));
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
        setErrorMessage(getErrorMessage('API_ERROR'));
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
