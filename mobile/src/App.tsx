import { useState, useEffect, useRef, useMemo } from 'react';
import { loadApiKey } from './services/storage';
import { shareSummary, copySummary } from './services/shareSummary';
import { usePromptManager } from './hooks/usePromptManager';
import { useSummarization } from './hooks/useSummarization';
import { useShareIntent } from './hooks/useShareIntent';
import { useFavoriteModels } from './hooks/useFavoriteModels';
import { useFontScale } from './hooks/useFontScale';
import { useModels } from './hooks/useModels';
import { Settings } from './components/Settings';
import { ManagePrompts } from './components/ManagePrompts';
import { ManageFavoriteModels } from './components/ManageFavoriteModels';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ErrorBanner } from './components/ErrorBanner';
import { SummaryView } from './components/SummaryView';
import { SpeedDialFAB } from './components/SpeedDialFAB';
import { Spinner, inputClass } from './components/ui';

type Page = 'main' | 'settings' | 'manage-prompts' | 'manage-favorite-models';

function MagpieLogo(): React.JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" className="h-7 w-7">
      <rect x="4" y="4" width="120" height="120" rx="24" ry="24" fill="#EF4444"/>
      <g transform="translate(20, 28) scale(0.72)" fill="white">
        <path fillRule="evenodd" d="M63.77,73l.9-1.53a126.15,126.15,0,0,1-26.83-2.29c-12.21,3.74-23,7-34.07,10.41A2.53,2.53,0,0,1,2,79a2.46,2.46,0,0,1-1.78-.26c-.69-.7.36-1.07.91-1.19a4,4,0,0,1,.91-.08l7.36-4.68-4,.64c-1.91.88-3.09.71-3.87,0,13.06-9,26.3-16.09,39.09-23.93,7.64-4.69,13.81-11.34,20.88-17.29,6.61-5.56,14-9.15,20.19-11.86C84.19,8.81,89.24,1.15,98.64,0a10.93,10.93,0,0,1,9.52,4.21c6.62.09,12.75.49,14.72,3.59-3.79,2.54-10,3.29-14.16,5-7.21,2.95-4.62,11.26-4.08,17.78s.61,13.87-3.09,21.55c-3.47,7.2-9.52,12.54-18.5,15.79L70.43,74.59c-2.14,1-1.81.76-1.31,3.32.84,4.31,2.66,9.16,4.79,14.78l7.46,1.71c1.21.3.77,4.45-.92,4.25l-10-1.35-9.78,1.86c-1,.32-1.34-4.22-.49-4.63L68.78,93A125.31,125.31,0,0,1,63.37,78.1c-.91-3.06-1.19-2.47.4-5.15ZM101.43,4.4A1.56,1.56,0,1,1,99.87,6a1.55,1.55,0,0,1,1.56-1.56Z"/>
      </g>
    </svg>
  );
}

export function App(): React.JSX.Element {
  const [url, setUrl] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelOverride, setModelOverride] = useState<string | null>(null);

  const { prompts, selectedPromptId, setSelectedPromptId, loadPromptData } = usePromptManager();
  const { favoriteIds, reloadFavorites } = useFavoriteModels();
  const { fontScale, setFontScale } = useFontScale();
  const { models } = useModels(apiKey);

  const summarization = useSummarization({ url, apiKey, selectedPromptId, modelOverride });
  const {
    state,
    summaryResult,
    displayContent,
    errorMessage,
    setErrorMessage,
    noKeyError,
    hasReceivedFirstChunk,
    handleSummarize,
    handleStop,
    cancel,
  } = summarization;

  // Keep a stable ref to handleSummarize for share intent auto-trigger
  const handleSummarizeRef = useRef(handleSummarize);
  handleSummarizeRef.current = handleSummarize;

  // Auto-scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  // useShareIntent wraps callbacks in refs internally, so closures stay fresh
  const { pendingShareUrl, consumePendingUrl } = useShareIntent({
    onYouTubeUrl: (shareUrl) => {
      cancel();
      setCurrentPage('main');
      summarization.reset();
      setUrl(shareUrl);
    },
    onNoYouTube: () => {
      setCurrentPage('main');
      summarization.reset();
      setErrorMessage('No YouTube URL found in shared content');
      setUrl('');
    },
  });

  // Load API key on mount
  useEffect(() => {
    void loadApiKey().then((key) => setApiKey(key));
    void loadPromptData();
  }, [loadPromptData]);

  // Reset model override when prompt changes
  useEffect(() => {
    setModelOverride(null);
  }, [selectedPromptId]);

  // Auto-summarize when a share URL is pending and app data is ready
  useEffect(() => {
    if (pendingShareUrl && apiKey && prompts.length > 0) {
      const urlToSummarize = consumePendingUrl();
      if (urlToSummarize) {
        void handleSummarizeRef.current(urlToSummarize);
      }
    }
  }, [pendingShareUrl, apiKey, prompts, consumePendingUrl]);

  // Track manual scroll-up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      userScrolledUpRef.current = distanceFromBottom > 50;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll on new streaming content
  useEffect(() => {
    if (state === 'streaming' && displayContent && !userScrolledUpRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [displayContent, state]);

  // Reset scroll tracking on new summarization
  useEffect(() => {
    if (state === 'fetching-transcript') {
      userScrolledUpRef.current = false;
    }
  }, [state]);

  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId),
    [prompts, selectedPromptId],
  );

  const effectiveModel = modelOverride ?? selectedPrompt?.model ?? '';

  const favoriteModels = useMemo(
    () => (models ?? []).filter((m) => favoriteIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [models, favoriteIds],
  );

  const isStreaming = state === 'streaming';
  const isFetchingTranscript = state === 'fetching-transcript';
  const isLoading = isFetchingTranscript || (isStreaming && !hasReceivedFirstChunk);
  const showStopBar = isStreaming && hasReceivedFirstChunk;
  const showFAB = state === 'done' && summaryResult !== null;

  if (currentPage === 'manage-favorite-models') {
    return (
      <ManageFavoriteModels
        onBack={() => {
          setCurrentPage('settings');
          reloadFavorites();
        }}
        apiKey={apiKey}
      />
    );
  }

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
        onManageFavoriteModels={() => setCurrentPage('manage-favorite-models')}
        onManagePrompts={() => setCurrentPage('manage-prompts')}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
      />
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MagpieLogo />
          <h1 className="text-lg font-semibold text-gray-800">Magpie</h1>
        </div>
        <button onClick={() => setCurrentPage('settings')} className="text-gray-500" aria-label="Settings">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Scrollable content: input area + summary */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto ${showStopBar ? 'pb-16' : showFAB ? 'pb-24' : ''}`}
      >
        {/* Input area */}
        <div className="px-4 pt-4 pb-2 space-y-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL"
            className={`w-full placeholder-gray-400 ${inputClass}`}
            disabled={isFetchingTranscript}
          />

          {/* Prompt + Model Selectors */}
          <div className="flex gap-2">
            <select
              value={selectedPromptId ?? ''}
              onChange={(e) => setSelectedPromptId(e.target.value)}
              disabled={isFetchingTranscript || isStreaming}
              className={`flex-1 min-w-0 bg-white ${inputClass}`}
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
            <select
              value={effectiveModel}
              onChange={(e) => setModelOverride(e.target.value)}
              disabled={isFetchingTranscript || isStreaming}
              className={`flex-1 min-w-0 bg-white ${inputClass}`}
            >
              {/* Always show current model if not already in favorites list */}
              {effectiveModel && !favoriteModels.some((m) => m.id === effectiveModel) && (
                <option value={effectiveModel}>
                  {models?.find((m) => m.id === effectiveModel)?.name ?? effectiveModel}
                </option>
              )}
              {favoriteModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              {/* Fallback when nothing else is available */}
              {!effectiveModel && favoriteModels.length === 0 && (
                <option value="">Select model</option>
              )}
            </select>
          </div>

          {/* Action button: Summarize / Fetching / Stop */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="w-full py-2 px-4 text-sm font-medium rounded-lg transition-colors bg-red-600 text-white hover:bg-red-700"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSummarize()}
              disabled={isFetchingTranscript}
              className={`w-full py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                isFetchingTranscript
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isFetchingTranscript ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Fetching transcript...
                </span>
              ) : (
                'Summarize'
              )}
            </button>
          )}
        </div>

        {/* Summary / Status area */}
        <div className="px-4 py-2">
        {isLoading && <LoadingIndicator state="fetching-transcript" />}

        {/* Streaming content */}
        {isStreaming && hasReceivedFirstChunk && (
          <SummaryView summary={displayContent} isStreaming />
        )}

        {/* Error with possible partial content */}
        {state === 'error' && summaryResult && (
          <SummaryView summary={summaryResult.summary} />
        )}

        {/* Error banner — show for both validation errors (idle state) and runtime errors */}
        {errorMessage && !isLoading && !isStreaming && (
          <ErrorBanner
            message={errorMessage}
            onGoToSettings={noKeyError ? () => setCurrentPage('settings') : undefined}
            onRetry={!noKeyError && state === 'error' ? () => void handleSummarize() : undefined}
          />
        )}

        {/* Completed summary */}
        {state === 'done' && summaryResult && <SummaryView summary={summaryResult.summary} />}
        </div>
      </div>

      {/* Floating stop bar */}
      {showStopBar && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <button
            type="button"
            onClick={handleStop}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop generating
          </button>
        </div>
      )}

      <SpeedDialFAB
        visible={state === 'done' && summaryResult !== null}
        onShare={() => { if (summaryResult) void shareSummary(summaryResult); }}
        onCopy={() => { if (summaryResult) void copySummary(summaryResult); }}
      />
    </div>
  );
}
