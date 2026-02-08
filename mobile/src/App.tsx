import { useState } from 'react';
import Markdown from 'react-markdown';
import { isValidYouTubeUrl, extractVideoId } from './utils/youtube';
import { fetchTranscript } from './services/transcript';
import { generateSummary } from './services/openrouter';
import { config } from './config';

type AppState = 'idle' | 'fetching-transcript' | 'generating-summary' | 'done' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL: 'Please enter a valid YouTube video URL',
  NO_CAPTIONS: 'No transcript available for this video',
  CONTEXT_TOO_LONG: 'This video is too long for the current model. Try a shorter video.',
  EXTRACTION_FAILED: 'Failed to extract transcript. Please try again.',
  API_ERROR: 'Failed to generate summary. Please try again.',
  NETWORK_ERROR: 'No internet connection. Please check your network.',
  INVALID_API_KEY: 'Failed to generate summary. Please try again.',
  RATE_LIMITED: 'Rate limited. Please try again later.',
  NO_API_KEY: 'API key not configured. The app cannot generate summaries.',
};

function Spinner({ className }: { className: string }): React.JSX.Element {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function LoadingIndicator({ state }: { state: AppState }): React.JSX.Element {
  const message = state === 'fetching-transcript' ? 'Fetching transcript...' : 'Generating summary...';
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
      <Spinner className="h-5 w-5" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function SummaryView({ summary }: { summary: string }): React.JSX.Element {
  return (
    <div className="prose prose-sm max-w-none text-gray-800">
      <Markdown>{summary}</Markdown>
    </div>
  );
}

export function App(): React.JSX.Element {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<AppState>('idle');
  const [summary, setSummary] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isLoading = state === 'fetching-transcript' || state === 'generating-summary';

  const handleSummarize = async () => {
    // Check API key first
    if (!config.openrouter.apiKey) {
      setErrorMessage(ERROR_MESSAGES.NO_API_KEY ?? 'Configuration error');
      return;
    }

    // Validate URL
    const trimmedUrl = url.trim();
    if (!isValidYouTubeUrl(trimmedUrl)) {
      setErrorMessage(ERROR_MESSAGES.INVALID_URL ?? 'Invalid URL');
      return;
    }

    const videoId = extractVideoId(trimmedUrl);
    if (!videoId) {
      setErrorMessage(ERROR_MESSAGES.INVALID_URL ?? 'Invalid URL');
      return;
    }

    // Phase 1: Fetch transcript
    setSummary('');
    setErrorMessage('');
    setState('fetching-transcript');

    const transcriptResult = await fetchTranscript(videoId);
    if (!transcriptResult.success) {
      setState('error');
      setErrorMessage(ERROR_MESSAGES[transcriptResult.error] ?? 'Failed to extract transcript.');
      return;
    }

    // Check context length
    if (transcriptResult.data.transcript.length > config.maxTranscriptChars) {
      setState('error');
      setErrorMessage(ERROR_MESSAGES.CONTEXT_TOO_LONG ?? 'Transcript too long');
      return;
    }

    // Phase 2: Generate summary
    setState('generating-summary');

    const summaryResult = await generateSummary(transcriptResult.data.transcript);
    if (!summaryResult.success) {
      setState('error');
      setErrorMessage(ERROR_MESSAGES[summaryResult.error] ?? 'Failed to generate summary.');
      return;
    }

    setSummary(summaryResult.data);
    setState('done');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-800">Magpie</h1>
      </header>

      {/* Input area */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube URL"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => void handleSummarize()}
          disabled={isLoading}
          className={`w-full py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
            isLoading
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4" />
              {state === 'fetching-transcript' ? 'Fetching transcript...' : 'Generating summary...'}
            </span>
          ) : (
            'Summarize'
          )}
        </button>
      </div>

      {/* Summary / Status area */}
      <div className="flex-1 px-4 py-2 overflow-y-auto">
        {isLoading && <LoadingIndicator state={state} />}

        {errorMessage && !isLoading && <ErrorBanner message={errorMessage} />}

        {state === 'done' && summary && <SummaryView summary={summary} />}
      </div>
    </div>
  );
}
