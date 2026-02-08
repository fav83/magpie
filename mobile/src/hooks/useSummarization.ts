import { useState, useRef } from 'react';
import { isValidYouTubeUrl, extractVideoId } from '../utils/youtube';
import { fetchTranscript } from '../services/transcript';
import { generateSummary } from '../services/openrouter';
import { getPromptById } from '../services/promptStorage';
import { config } from '../config';

export interface SummaryResult {
  summary: string;
  title: string;
  url: string;
}

export type SummarizationState = 'idle' | 'fetching-transcript' | 'generating-summary' | 'done' | 'error';

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
}

export function useSummarization({ url, apiKey, selectedPromptId }: UseSummarizationParams) {
  const [state, setState] = useState<SummarizationState>('idle');
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [noKeyError, setNoKeyError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSummarize = async (urlOverride?: string) => {
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
    const model = prompt?.model ?? config.defaultModel;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Phase 1: Fetch transcript
    setSummaryResult(null);
    setErrorMessage('');
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

    // Phase 2: Generate summary
    setState('generating-summary');

    const genResult = await generateSummary(
      transcriptResult.data.transcript,
      apiKey,
      promptText,
      model,
      controller.signal
    );
    if (!genResult.success) {
      if (controller.signal.aborted) return;
      setState('error');
      setErrorMessage(ERROR_MESSAGES[genResult.error] ?? 'Failed to generate summary.');
      return;
    }

    const targetUrl = (urlOverride ?? url).trim();
    setSummaryResult({
      summary: genResult.data,
      title: transcriptResult.data.title,
      url: targetUrl,
    });
    setState('done');
  };

  const reset = () => {
    setState('idle');
    setSummaryResult(null);
    setErrorMessage('');
    setNoKeyError(false);
  };

  return {
    state,
    summaryResult,
    errorMessage,
    setErrorMessage,
    noKeyError,
    handleSummarize,
    reset,
  };
}
