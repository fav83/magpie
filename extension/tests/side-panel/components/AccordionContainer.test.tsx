import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccordionContainer } from '../../../src/side-panel/components/AccordionContainer';
import type { AccordionItem } from '../../../src/types/accordion';
import type { StreamingItem } from '../../../src/types/streaming';

// Mock AccordionItem
vi.mock('../../../src/side-panel/components/AccordionItem', () => ({
  AccordionItem: ({
    item,
    isCurrentVideo,
    isExpanded,
    onToggle,
    onDelete,
    onRegenerate,
    onRetry,
    error,
  }: {
    item: AccordionItem;
    isCurrentVideo: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (() => void) | undefined;
    onRegenerate: (promptId: string, modelId: string) => void;
    onRetry: (() => void) | undefined;
    error: string | undefined;
  }) => (
    <div data-testid={`accordion-item-${item.id}`}>
      <span data-testid="is-current">{isCurrentVideo ? 'current' : 'history'}</span>
      <span data-testid="is-expanded">{isExpanded ? 'expanded' : 'collapsed'}</span>
      <span data-testid="error">{error ?? 'none'}</span>
      <button data-testid="toggle" onClick={onToggle}>Toggle</button>
      {onDelete && <button data-testid="delete" onClick={onDelete}>Delete</button>}
      <button data-testid="regenerate" onClick={() => onRegenerate('p1', 'm1')}>Regenerate</button>
      {onRetry && <button data-testid="retry" onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

// Mock StreamingAccordionItem
vi.mock('../../../src/side-panel/components/StreamingAccordionItem', () => ({
  StreamingAccordionItem: ({ item, isExpanded, onToggle, onCancel, onRetry, onDelete }: {
    item: StreamingItem;
    isExpanded: boolean;
    onToggle: () => void;
    onCancel: () => void;
    onRetry: () => void;
    onDelete: () => void;
  }) => (
    <div data-testid="streaming-item" data-current={item.status === 'streaming' ? 'true' : 'false'}>
      <span data-testid="streaming-title">{item.videoTitle}</span>
      <span data-testid="streaming-prompt">{item.promptName}</span>
      <span data-testid="streaming-status">{item.status}</span>
      <span data-testid="streaming-expanded">{isExpanded ? 'expanded' : 'collapsed'}</span>
      <button data-testid="streaming-toggle" onClick={onToggle}>Toggle</button>
      <button data-testid="streaming-cancel" onClick={onCancel}>Cancel</button>
      <button data-testid="streaming-retry" onClick={onRetry}>Retry</button>
      <button data-testid="streaming-delete" onClick={onDelete}>Delete</button>
    </div>
  ),
}));

// Mock EmptyState
vi.mock('../../../src/side-panel/components/EmptyState', () => ({
  EmptyState: () => (
    <div data-testid="empty-state">
      No summaries
    </div>
  ),
}));

// Mock GeneratePanel
vi.mock('../../../src/side-panel/components/GeneratePanel', () => ({
  GeneratePanel: ({ onGenerate }: { onGenerate: (promptId: string, modelId: string) => void }) => (
    <div data-testid="generate-panel">
      <button onClick={() => onGenerate('default-prompt', 'default-model')}>Generate Summary</button>
    </div>
  ),
}));

const createStreamingItem = (videoId: string, promptId: string, overrides?: Partial<StreamingItem>): StreamingItem => ({
  id: `${videoId}_${promptId}`,
  videoId,
  videoTitle: `Video ${videoId}`,
  videoUrl: `https://youtube.com/watch?v=${videoId}`,
  promptId,
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  content: '',
  fullContent: '',
  status: 'streaming',
  ...overrides,
});

const createItem = (id: string, videoId: string): AccordionItem => ({
  id,
  videoId,
  videoTitle: `Video ${id}`,
  videoUrl: `https://youtube.com/watch?v=${videoId}`,
  promptId: 'prompt1',
  promptName: 'Default Summary',
  modelId: 'openai/gpt-4o-mini',
  summary: 'Test summary',
  timestamp: Date.now(),
});

describe('AccordionContainer', () => {
  const defaultProps = {
    items: [] as AccordionItem[],
    currentVideoId: null as string | null,
    currentTabId: 123 as number | null,
    expandedIds: new Set<string>(),
    streamingItems: new Map<string, StreamingItem>(),
    onToggle: vi.fn(),
    onDelete: vi.fn(),
    onRegenerate: vi.fn(),
    onRetry: vi.fn(),
    onCancelStream: vi.fn(),
    onGenerateForCurrentVideo: vi.fn(),
    itemErrors: new Map<string, string>(),
    apiKey: 'test-api-key' as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should show empty state when no items and no pending', () => {
      render(<AccordionContainer {...defaultProps} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should not show empty state when items exist', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} />);

      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });

    it('should not show empty state when streaming item exists', () => {
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { videoTitle: 'New Video' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          streamingItems={streamingItems}
          currentVideoId="v1"
        />
      );

      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  describe('streaming items', () => {
    it('should show streaming item when streaming for current video', () => {
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { videoTitle: 'Loading Video' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          streamingItems={streamingItems}
          currentVideoId="v1"
        />
      );

      expect(screen.getByTestId('streaming-item')).toBeInTheDocument();
      expect(screen.getByTestId('streaming-title')).toHaveTextContent('Loading Video');
      expect(screen.getByTestId('streaming-prompt')).toHaveTextContent('Default Summary');
    });

    it('should show streaming item at top before items', () => {
      const items = [createItem('v1_p1', 'v1')];
      const streamingItems = new Map([
        ['v2_p1', createStreamingItem('v2', 'p1', { videoTitle: 'New Video' })],
      ]);
      const { container } = render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          streamingItems={streamingItems}
          currentVideoId="v2"
        />
      );

      const children = container.querySelector('.space-y-0')?.children;
      expect(children?.[0]).toHaveAttribute('data-testid', 'streaming-item');
    });

    it('should show multiple streaming items', () => {
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { videoTitle: 'Video 1' })],
        ['v2_p1', createStreamingItem('v2', 'p1', { videoTitle: 'Video 2' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          streamingItems={streamingItems}
          currentVideoId="v2"
        />
      );

      expect(screen.getAllByTestId('streaming-item')).toHaveLength(2);
    });

    it('should mark streaming item for current video correctly', () => {
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { videoTitle: 'Current Video' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          streamingItems={streamingItems}
          currentVideoId="v1"
        />
      );

      // Streaming items are always shown as streaming status
      expect(screen.getByTestId('streaming-item')).toHaveAttribute('data-current', 'true');
    });

    it('should show error streaming item correctly', () => {
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { status: 'error', error: 'API error' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          streamingItems={streamingItems}
          currentVideoId="v1"
        />
      );

      expect(screen.getByTestId('streaming-status')).toHaveTextContent('error');
    });

    it('should show streaming version instead of accordion item when regenerating (model change)', () => {
      // Existing item and streaming item with SAME ID (model change scenario)
      const items = [createItem('v1_p1', 'v1')];
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { videoTitle: 'Test Video' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          streamingItems={streamingItems}
          currentVideoId="v1"
        />
      );

      // Should show StreamingAccordionItem (with cancel button), NOT regular AccordionItem
      expect(screen.getByTestId('streaming-item')).toBeInTheDocument();
      expect(screen.queryByTestId('accordion-item-v1_p1')).not.toBeInTheDocument();
      // Cancel button should be available
      expect(screen.getByTestId('streaming-cancel')).toBeInTheDocument();
    });

    it('should not duplicate streaming item when regenerating existing item', () => {
      // Existing item and streaming item with SAME ID - should only show once
      const items = [
        createItem('v1_p1', 'v1'),
        createItem('v2_p1', 'v2'),
      ];
      const streamingItems = new Map([
        ['v1_p1', createStreamingItem('v1', 'p1', { videoTitle: 'Regenerating' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          streamingItems={streamingItems}
          currentVideoId="v1"
        />
      );

      // Only ONE streaming item should be shown
      expect(screen.getAllByTestId('streaming-item')).toHaveLength(1);
      // The other item should still be an accordion item
      expect(screen.getByTestId('accordion-item-v2_p1')).toBeInTheDocument();
    });
  });

  describe('items rendering', () => {
    it('should render all items', () => {
      const items = [
        createItem('v1_p1', 'v1'),
        createItem('v2_p1', 'v2'),
        createItem('v3_p1', 'v3'),
      ];
      render(<AccordionContainer {...defaultProps} items={items} />);

      expect(screen.getByTestId('accordion-item-v1_p1')).toBeInTheDocument();
      expect(screen.getByTestId('accordion-item-v2_p1')).toBeInTheDocument();
      expect(screen.getByTestId('accordion-item-v3_p1')).toBeInTheDocument();
    });

    it('should mark current video items correctly', () => {
      const items = [
        createItem('v1_p1', 'v1'),
        createItem('v2_p1', 'v2'),
      ];
      render(<AccordionContainer {...defaultProps} items={items} currentVideoId="v1" />);

      const v1Item = screen.getByTestId('accordion-item-v1_p1');
      const v2Item = screen.getByTestId('accordion-item-v2_p1');

      expect(v1Item.querySelector('[data-testid="is-current"]')).toHaveTextContent('current');
      expect(v2Item.querySelector('[data-testid="is-current"]')).toHaveTextContent('history');
    });

    it('should mark expanded items correctly', () => {
      const items = [
        createItem('v1_p1', 'v1'),
        createItem('v2_p1', 'v2'),
      ];
      render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          expandedIds={new Set(['v1_p1'])}
        />
      );

      const v1Item = screen.getByTestId('accordion-item-v1_p1');
      const v2Item = screen.getByTestId('accordion-item-v2_p1');

      expect(v1Item.querySelector('[data-testid="is-expanded"]')).toHaveTextContent('expanded');
      expect(v2Item.querySelector('[data-testid="is-expanded"]')).toHaveTextContent('collapsed');
    });

    it('should pass error to item correctly', () => {
      const items = [createItem('v1_p1', 'v1')];
      const errors = new Map([['v1_p1', 'Some error message']]);
      render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          itemErrors={errors}
        />
      );

      const item = screen.getByTestId('accordion-item-v1_p1');
      expect(item.querySelector('[data-testid="error"]')).toHaveTextContent('Some error message');
    });
  });

  describe('delete button visibility', () => {
    it('should show delete button for history items', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} currentVideoId="v2" />);

      expect(screen.getByTestId('delete')).toBeInTheDocument();
    });

    it('should show delete button for current video items', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} currentVideoId="v1" />);

      expect(screen.getByTestId('delete')).toBeInTheDocument();
    });
  });

  describe('generate button for current video', () => {
    it('should show generate button when current video has no summary', () => {
      const historyItems = [createItem('v1_p1', 'v1')];
      render(
        <AccordionContainer
          {...defaultProps}
          items={historyItems}
          currentVideoId="v2"
        />
      );

      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    it('should not show generate button when current video has summary', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          currentVideoId="v1"
        />
      );

      expect(screen.queryByText('Generate Summary')).not.toBeInTheDocument();
    });

    it('should not show generate button when current video has streaming item', () => {
      const streamingItems = new Map([
        ['v2_p1', createStreamingItem('v2', 'p1', { videoTitle: 'New Video' })],
      ]);
      render(
        <AccordionContainer
          {...defaultProps}
          streamingItems={streamingItems}
          currentVideoId="v2"
        />
      );

      expect(screen.queryByText('Generate Summary')).not.toBeInTheDocument();
    });

    it('should not show generate button when no current video', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(
        <AccordionContainer
          {...defaultProps}
          items={items}
          currentVideoId={null}
        />
      );

      expect(screen.queryByText('Generate Summary')).not.toBeInTheDocument();
    });

    it('should call onGenerateForCurrentVideo when generate button is clicked', () => {
      const historyItems = [createItem('v1_p1', 'v1')];
      render(
        <AccordionContainer
          {...defaultProps}
          items={historyItems}
          currentVideoId="v2"
        />
      );

      fireEvent.click(screen.getByText('Generate Summary'));

      expect(defaultProps.onGenerateForCurrentVideo).toHaveBeenCalled();
    });

    it('should show GeneratePanel alongside EmptyState when currentVideoId is set', () => {
      render(
        <AccordionContainer
          {...defaultProps}
          currentVideoId="v1"
        />
      );

      // Both EmptyState and GeneratePanel should be visible
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('generate-panel')).toBeInTheDocument();

      // Clicking generate should call onGenerateForCurrentVideo
      fireEvent.click(screen.getByText('Generate Summary'));
      expect(defaultProps.onGenerateForCurrentVideo).toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('should call onToggle with item id', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} />);

      fireEvent.click(screen.getByTestId('toggle'));

      expect(defaultProps.onToggle).toHaveBeenCalledWith('v1_p1');
    });

    it('should call onDelete with item id', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} currentVideoId="v2" />);

      fireEvent.click(screen.getByTestId('delete'));

      expect(defaultProps.onDelete).toHaveBeenCalledWith('v1_p1');
    });

    it('should call onRegenerate with videoId, promptId, modelId, originalItemId', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} />);

      fireEvent.click(screen.getByTestId('regenerate'));

      expect(defaultProps.onRegenerate).toHaveBeenCalledWith('v1', 'p1', 'm1', 'v1_p1', undefined);
    });

    it('should call onRetry with item id', () => {
      const items = [createItem('v1_p1', 'v1')];
      render(<AccordionContainer {...defaultProps} items={items} />);

      fireEvent.click(screen.getByTestId('retry'));

      expect(defaultProps.onRetry).toHaveBeenCalledWith('v1_p1');
    });
  });
});
