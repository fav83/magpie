import { useAccordion } from './hooks/useAccordion';
import { AccordionContainer } from './components/AccordionContainer';
import { Loading } from './components/Loading';
import { InlineError } from './components/InlineError';
import { GeneratePanel } from './components/GeneratePanel';
import { ApiKeySetup } from './components/ApiKeySetup';
import { SidebarLayout } from './components/SidebarLayout';
import { Tooltip } from './components/Tooltip';
import { buildItemId } from '../utils/accordionStorage';
import { ExpandAllIcon, CollapseAllIcon, DeleteIcon } from './components/Icons';
import { STORAGE_KEYS } from '../config';
import { useChromeStorage } from '../hooks/useChromeStorage';

export function App(): React.JSX.Element {
  // Check for API key directly - also get isLoading to avoid race conditions
  const [apiKey, , isApiKeyLoading] = useChromeStorage<string | null>(STORAGE_KEYS.API_KEY, null);

  const {
    items,
    currentVideoId,
    currentTabId,
    expandedIds,
    streamingItems,
    error,
    itemErrors,
    isInitializing,
    toggleItem,
    expandAll,
    collapseAll,
    deleteItem,
    deleteAllItems,
    generateSummary,
    generateForCurrentVideo,
    retryItem,
    cancelStream,
  } = useAccordion();

  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete all summaries? This action cannot be undone.')) {
      void deleteAllItems();
    }
  };

  const handleRegenerate = (videoId: string, promptId: string, modelId: string, originalItemId: string, customPromptText?: string) => {
    // Find the original item to get title/URL
    const originalItem = items.find((item) => item.id === originalItemId);
    if (!originalItem) return; // Should not happen when regenerating

    // Determine if this is a model change (same prompt) or prompt change (replace item)
    const newItemId = buildItemId(videoId, promptId);
    const isPromptChange = newItemId !== originalItemId;
    const isModelChange = !isPromptChange && originalItem.modelId !== modelId;

    // Pass the original item ID if prompt changed (so we can replace it)
    const replaceItemId = isPromptChange ? originalItemId : undefined;

    generateSummary(videoId, originalItem.videoTitle, originalItem.videoUrl, promptId, modelId, isModelChange, replaceItemId, customPromptText);
  };

  // Show loading spinner during initialization (including API key loading)
  if (isInitializing || isApiKeyLoading) {
    return (
      <div className="p-4 min-h-screen bg-white">
        <Loading />
      </div>
    );
  }

  const hasNoItems = items.length === 0 && streamingItems.size === 0;
  const totalItems = items.length + streamingItems.size;
  const allExpanded = totalItems > 0 && expandedIds.size === totalItems;
  const hasItems = totalItems > 0;

  // Footer buttons for expand/collapse and delete all (only when items exist)
  const itemManagementButtons = (
    <>
      <Tooltip content={allExpanded ? 'Collapse all' : 'Expand all'}>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!hasItems}
        >
          {allExpanded ? (
            <CollapseAllIcon className="w-4 h-4" />
          ) : (
            <ExpandAllIcon className="w-4 h-4" />
          )}
        </button>
      </Tooltip>
      <Tooltip content="Delete all summaries">
        <button
          onClick={handleDeleteAll}
          aria-label="Delete all summaries"
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!hasItems}
        >
          <DeleteIcon className="w-4 h-4" />
        </button>
      </Tooltip>
    </>
  );

  // Show API key setup when no API key and no items - vertically centered
  if (!apiKey && hasNoItems) {
    return (
      <SidebarLayout centerContent>
        <ApiKeySetup />
      </SidebarLayout>
    );
  }

  // Show error state with generate panel if error and no items to display (but API key exists)
  if (error && hasNoItems && currentVideoId) {
    return (
      <SidebarLayout>
        <div className="p-2">
          <InlineError message={error} onRetry={undefined} />
        </div>
        <GeneratePanel onGenerate={(promptId, modelId) => void generateForCurrentVideo(promptId, modelId)} />
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout footerButtons={itemManagementButtons}>
      {/* Show inline error if we have items but also an error */}
      {error && (items.length > 0 || streamingItems.size > 0) && (
        <div className="mx-2 my-2">
          <InlineError message={error} onRetry={undefined} />
        </div>
      )}

      <AccordionContainer
        items={items}
        currentVideoId={currentVideoId}
        currentTabId={currentTabId}
        expandedIds={expandedIds}
        streamingItems={streamingItems}
        onToggle={toggleItem}
        onDelete={(id) => void deleteItem(id)}
        onRegenerate={handleRegenerate}
        onRetry={(id) => void retryItem(id)}
        onCancelStream={cancelStream}
        onGenerateForCurrentVideo={(promptId, modelId) => void generateForCurrentVideo(promptId, modelId)}
        itemErrors={itemErrors}
        apiKey={apiKey}
      />
    </SidebarLayout>
  );
}
