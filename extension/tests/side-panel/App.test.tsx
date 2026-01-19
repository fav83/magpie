import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../src/side-panel/App';
import type { AccordionItem } from '../../src/types/accordion';

// Mock the useAccordion hook
const mockToggleItem = vi.fn();
const mockDeleteItem = vi.fn().mockResolvedValue(undefined);
const mockGenerateSummary = vi.fn().mockResolvedValue(undefined);
const mockUseAccordion = vi.fn();

vi.mock('../../src/side-panel/hooks/useAccordion', () => ({
  useAccordion: () => mockUseAccordion(),
}));

// Mock accordionStorage for buildItemId
vi.mock('../../src/utils/accordionStorage', () => ({
  buildItemId: (videoId: string, promptId: string) => `${videoId}_${promptId}`,
}));

// Mock useChromeStorage to provide API key
const mockApiKey = vi.fn<() => string | null>().mockReturnValue('test-api-key');
vi.mock('../../src/hooks/useChromeStorage', () => ({
  useChromeStorage: () => [mockApiKey(), vi.fn(), false], // [value, setValue, isLoading]
}));

// Mock the child components for isolation
vi.mock('../../src/side-panel/components/Loading', () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('../../src/side-panel/components/AccordionContainer', () => ({
  AccordionContainer: ({
    items,
    currentVideoId,
    streamingItems,
    onToggle,
    onDelete,
    onRegenerate,
  }: {
    items: AccordionItem[];
    currentVideoId: string | null;
    streamingItems: Map<string, unknown>;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onRegenerate: (videoId: string, promptId: string, modelId: string, originalItemId: string) => void;
  }) => (
    <div data-testid="accordion-container">
      <span data-testid="item-count">{items.length}</span>
      <span data-testid="current-video">{currentVideoId ?? 'none'}</span>
      <span data-testid="has-streaming">{streamingItems.size > 0 ? 'yes' : 'no'}</span>
      {items.map((item) => (
        <div key={item.id} data-testid={`item-${item.id}`}>
          <button
            data-testid={`toggle-${item.id}`}
            onClick={() => onToggle(item.id)}
          >
            Toggle
          </button>
          <button
            data-testid={`delete-${item.id}`}
            onClick={() => onDelete(item.id)}
          >
            Delete
          </button>
          <button
            data-testid={`regenerate-${item.id}`}
            onClick={() => onRegenerate(item.videoId, 'new-prompt', 'new-model', item.id)}
          >
            Regenerate
          </button>
        </div>
      ))}
    </div>
  ),
}));

// Mock InlineError
vi.mock('../../src/side-panel/components/InlineError', () => ({
  InlineError: ({ message }: { message: string; onRetry?: () => void }) => (
    <div data-testid="inline-error">
      <span data-testid="error-message">{message}</span>
    </div>
  ),
}));

// Mock GeneratePanel
vi.mock('../../src/side-panel/components/GeneratePanel', () => ({
  GeneratePanel: ({ onGenerate }: { onGenerate: (promptId: string, modelId: string) => void }) => (
    <div data-testid="generate-panel">
      <button onClick={() => onGenerate('default-prompt', 'default-model')}>Generate Summary</button>
    </div>
  ),
}));

// Mock ApiKeySetup
vi.mock('../../src/side-panel/components/ApiKeySetup', () => ({
  ApiKeySetup: () => <div data-testid="api-key-setup">API Key Setup Form</div>,
}));

// Mock Tooltip
vi.mock('../../src/side-panel/components/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Icons
vi.mock('../../src/side-panel/components/Icons', () => ({
  SettingsIcon: () => <span data-testid="settings-icon" />,
  ExpandAllIcon: () => <span data-testid="expand-icon" />,
  CollapseAllIcon: () => <span data-testid="collapse-icon" />,
  DeleteIcon: () => <span data-testid="delete-icon" />,
}));

const sampleItem: AccordionItem = {
  id: 'video1_prompt1',
  videoId: 'video1',
  videoTitle: 'Test Video',
  videoUrl: 'https://youtube.com/watch?v=video1',
  promptId: 'prompt1',
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  summary: 'This is a test summary',
  timestamp: Date.now(),
};

describe('Side Panel App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show Loading component when initializing', () => {
    mockUseAccordion.mockReturnValue({
      items: [],
      currentVideoId: null,
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: true,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('accordion-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-error')).not.toBeInTheDocument();
  });

  it('should show AccordionContainer when initialized with items', () => {
    mockUseAccordion.mockReturnValue({
      items: [sampleItem],
      currentVideoId: 'video1',
      expandedIds: new Set(['video1_prompt1']),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('accordion-container')).toBeInTheDocument();
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    expect(screen.getByTestId('current-video')).toHaveTextContent('video1');
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-error')).not.toBeInTheDocument();
  });

  it('should show ApiKeySetup when no API key and no items', () => {
    mockApiKey.mockReturnValue(null);
    mockUseAccordion.mockReturnValue({
      items: [],
      currentVideoId: 'video1',
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('api-key-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('inline-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('generate-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('accordion-container')).not.toBeInTheDocument();
    // Restore mock for other tests
    mockApiKey.mockReturnValue('test-api-key');
  });

  it('should show InlineError with GeneratePanel when error and no items', () => {
    mockUseAccordion.mockReturnValue({
      items: [],
      currentVideoId: 'video1', // Must have currentVideoId to show error state
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: 'Something went wrong',
      itemErrors: new Map(),
      isInitializing: false,
      regeneratingId: null,
      toggleItem: mockToggleItem,
      deleteItem: mockDeleteItem,
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteAllItems: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('inline-error')).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Something went wrong');
    expect(screen.getByTestId('generate-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('accordion-container')).not.toBeInTheDocument();
  });

  it('should show inline error when error but has items', () => {
    mockUseAccordion.mockReturnValue({
      items: [sampleItem],
      currentVideoId: 'video1',
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: 'Some error occurred',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('accordion-container')).toBeInTheDocument();
    expect(screen.getByTestId('inline-error')).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Some error occurred');
  });

  it('should call toggleItem when toggle is triggered', () => {
    mockUseAccordion.mockReturnValue({
      items: [sampleItem],
      currentVideoId: 'video1',
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('toggle-video1_prompt1'));

    expect(mockToggleItem).toHaveBeenCalledWith('video1_prompt1');
  });

  it('should call deleteItem when delete is triggered', () => {
    mockUseAccordion.mockReturnValue({
      items: [sampleItem],
      currentVideoId: 'video1',
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('delete-video1_prompt1'));

    expect(mockDeleteItem).toHaveBeenCalledWith('video1_prompt1');
  });

  it('should call generateSummary when regenerate is triggered', () => {
    mockUseAccordion.mockReturnValue({
      items: [sampleItem],
      currentVideoId: 'video1',
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('regenerate-video1_prompt1'));

    // handleRegenerate gets videoId, promptId, modelId, originalItemId from AccordionContainer
    // It then looks up the original item to get title/URL and determines if it's a prompt change
    // For a different prompt (new-prompt vs prompt1), it's a prompt change so replaceItemId is set
    expect(mockGenerateSummary).toHaveBeenCalledWith(
      'video1',           // videoId
      'Test Video',       // videoTitle from original item
      'https://youtube.com/watch?v=video1', // videoUrl from original item
      'new-prompt',       // promptId
      'new-model',        // modelId
      false,              // isModelChange (false because prompt changed)
      'video1_prompt1',   // replaceItemId (set because prompt changed)
      undefined           // customPromptText
    );
  });

  it('should have proper container styling', () => {
    mockUseAccordion.mockReturnValue({
      items: [],
      currentVideoId: null,
      expandedIds: new Set(),
      streamingItems: new Map(),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    const { container } = render(<App />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('h-screen', 'flex', 'flex-col', 'bg-white');
  });

  it('should show streaming item indicator', () => {
    mockUseAccordion.mockReturnValue({
      items: [],
      currentVideoId: 'video1',
      expandedIds: new Set(),
      streamingItems: new Map([
        ['video1_prompt1', {
          id: 'video1_prompt1',
          videoId: 'video1',
          videoTitle: 'New Video',
          videoUrl: 'https://youtube.com/watch?v=video1',
          promptId: 'prompt1',
          promptName: 'Default',
          modelId: 'openai/gpt-4o-mini',
          content: '',
          fullContent: '',
          status: 'streaming',
        }],
      ]),
      error: '',
      itemErrors: new Map(),
      isInitializing: false,
      toggleItem: mockToggleItem,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      deleteItem: mockDeleteItem,
      deleteAllItems: vi.fn(),
      generateSummary: mockGenerateSummary,
      generateForCurrentVideo: vi.fn(),
      retryItem: vi.fn(),
      cancelStream: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId('has-streaming')).toHaveTextContent('yes');
  });
});
