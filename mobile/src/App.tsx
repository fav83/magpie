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
        <h1 className="text-lg font-semibold text-gray-800">Magpie</h1>
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
