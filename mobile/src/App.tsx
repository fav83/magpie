import { useState, useEffect, useRef, useCallback } from 'react';
import { loadApiKey } from './services/storage';
import { shareSummary, copySummary } from './services/shareSummary';
import { usePromptManager } from './hooks/usePromptManager';
import { useSummarization } from './hooks/useSummarization';
import { useShareIntent } from './hooks/useShareIntent';
import { Settings } from './components/Settings';
import { ManagePrompts } from './components/ManagePrompts';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ErrorBanner } from './components/ErrorBanner';
import { SummaryView } from './components/SummaryView';
import { SpeedDialFAB } from './components/SpeedDialFAB';
import { Spinner } from './components/ui';

type Page = 'main' | 'settings' | 'manage-prompts';

export function App(): React.JSX.Element {
  const [url, setUrl] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [apiKey, setApiKey] = useState<string | null>(null);

  const { prompts, selectedPromptId, setSelectedPromptId, loadPromptData } = usePromptManager();

  const summarization = useSummarization({ url, apiKey, selectedPromptId });
  const { state, summaryResult, errorMessage, setErrorMessage, noKeyError, handleSummarize } = summarization;

  // Keep a stable ref to handleSummarize for share intent auto-trigger
  const handleSummarizeRef = useRef(handleSummarize);
  handleSummarizeRef.current = handleSummarize;

  const resetRef = useRef(summarization.reset);
  resetRef.current = summarization.reset;

  const resetMainScreen = useCallback(() => {
    setCurrentPage('main');
    resetRef.current();
  }, []);

  const { pendingShareUrl, consumePendingUrl } = useShareIntent({
    onYouTubeUrl: (shareUrl) => {
      resetMainScreen();
      setUrl(shareUrl);
    },
    onNoYouTube: () => {
      resetMainScreen();
      setErrorMessage('No YouTube URL found in shared content');
      setUrl('');
    },
  });

  // Load API key on mount
  useEffect(() => {
    void loadApiKey().then((key) => setApiKey(key));
    void loadPromptData();
  }, [loadPromptData]);

  // Auto-summarize when a share URL is pending and app data is ready
  useEffect(() => {
    if (pendingShareUrl && apiKey && prompts.length > 0) {
      const urlToSummarize = consumePendingUrl();
      if (urlToSummarize) {
        void handleSummarizeRef.current(urlToSummarize);
      }
    }
  }, [pendingShareUrl, apiKey, prompts, consumePendingUrl]);

  const isLoading = state === 'fetching-transcript' || state === 'generating-summary';

  if (currentPage === 'manage-prompts') {
    return (
      <ManagePrompts
        onBack={() => {
          setCurrentPage('settings');
          void loadPromptData();
        }}
        apiKey={apiKey}
      />
    );
  }

  if (currentPage === 'settings') {
    return (
      <Settings
        onBack={() => setCurrentPage('main')}
        onKeySaved={(key) => setApiKey(key)}
        onManagePrompts={() => setCurrentPage('manage-prompts')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" className="h-7 w-7">
            <rect x="4" y="4" width="120" height="120" rx="24" ry="24" fill="#EF4444"/>
            <g transform="translate(20, 28) scale(0.72)" fill="white">
              <path fillRule="evenodd" d="M63.77,73l.9-1.53a126.15,126.15,0,0,1-26.83-2.29c-12.21,3.74-23,7-34.07,10.41A2.53,2.53,0,0,1,2,79a2.46,2.46,0,0,1-1.78-.26c-.69-.7.36-1.07.91-1.19a4,4,0,0,1,.91-.08l7.36-4.68-4,.64c-1.91.88-3.09.71-3.87,0,13.06-9,26.3-16.09,39.09-23.93,7.64-4.69,13.81-11.34,20.88-17.29,6.61-5.56,14-9.15,20.19-11.86C84.19,8.81,89.24,1.15,98.64,0a10.93,10.93,0,0,1,9.52,4.21c6.62.09,12.75.49,14.72,3.59-3.79,2.54-10,3.29-14.16,5-7.21,2.95-4.62,11.26-4.08,17.78s.61,13.87-3.09,21.55c-3.47,7.2-9.52,12.54-18.5,15.79L70.43,74.59c-2.14,1-1.81.76-1.31,3.32.84,4.31,2.66,9.16,4.79,14.78l7.46,1.71c1.21.3.77,4.45-.92,4.25l-10-1.35-9.78,1.86c-1,.32-1.34-4.22-.49-4.63L68.78,93A125.31,125.31,0,0,1,63.37,78.1c-.91-3.06-1.19-2.47.4-5.15ZM101.43,4.4A1.56,1.56,0,1,1,99.87,6a1.55,1.55,0,0,1,1.56-1.56Z"/>
            </g>
          </svg>
          <h1 className="text-lg font-semibold text-gray-800">Magpie</h1>
        </div>
        <button onClick={() => setCurrentPage('settings')} className="text-gray-500" aria-label="Settings">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
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

        {/* Prompt Selector */}
        <select
          value={selectedPromptId ?? ''}
          onChange={(e) => setSelectedPromptId(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.isDefault ? ' (Default)' : ''}
            </option>
          ))}
        </select>

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

        {errorMessage && !isLoading && (
          <ErrorBanner
            message={errorMessage}
            onGoToSettings={noKeyError ? () => setCurrentPage('settings') : undefined}
          />
        )}

        {state === 'done' && summaryResult && <SummaryView summary={summaryResult.summary} />}
      </div>

      <SpeedDialFAB
        visible={state === 'done' && summaryResult !== null}
        onShare={() => { if (summaryResult) void shareSummary(summaryResult); }}
        onCopy={() => { if (summaryResult) void copySummary(summaryResult); }}
      />
    </div>
  );
}
