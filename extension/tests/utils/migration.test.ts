import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupChromeMock, resetChromeMock, chromeMock } from '../mocks/chrome';

// Mock promptStorage
vi.mock('../../src/utils/promptStorage', () => ({
  getPromptById: vi.fn(),
}));

import { getPromptById } from '../../src/utils/promptStorage';
import { migrateOldCache } from '../../src/utils/migration';

setupChromeMock();

const mockGetPromptById = getPromptById as ReturnType<typeof vi.fn>;

describe('migrateOldCache', () => {
  beforeEach(() => {
    resetChromeMock();
    vi.clearAllMocks();
    mockGetPromptById.mockResolvedValue({
      id: 'prompt1',
      name: 'Test Prompt',
      text: 'Summarize',
      model: 'openai/gpt-4o-mini',
      isDefault: true,
    });
  });

  it('should skip migration if already completed', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      accordionMigrationComplete: true,
    });

    await migrateOldCache();

    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  it('should mark migration complete when no old cache exists', async () => {
    chromeMock.storage.local.get.mockResolvedValue({});

    await migrateOldCache();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      accordionMigrationComplete: true,
    });
  });

  it('should mark migration complete when old cache is empty', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: {},
    });

    await migrateOldCache();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      accordionMigrationComplete: true,
    });
  });

  it('should migrate old cache entries to accordion items', async () => {
    // Video ID must be exactly 11 characters
    const oldCache = {
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o-mini': {
        summary: 'Test summary',
        videoTitle: 'Test Video',
        modelId: 'openai/gpt-4o-mini',
        timestamp: 1000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      accordionItems: expect.arrayContaining([
        expect.objectContaining({
          id: 'dQw4w9WgXcQ_prompt1',
          videoId: 'dQw4w9WgXcQ',
          videoTitle: 'Test Video',
          promptId: 'prompt1',
          promptName: 'Test Prompt',
          modelId: 'openai/gpt-4o-mini',
          summary: 'Test summary',
          timestamp: 1000,
        }),
      ]),
      accordionMigrationComplete: true,
    });
  });

  it('should keep only newest entry when same video+prompt has multiple models', async () => {
    // Video ID must be exactly 11 characters
    const oldCache = {
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o-mini': {
        summary: 'Old summary',
        videoTitle: 'Test Video',
        modelId: 'openai/gpt-4o-mini',
        timestamp: 1000,
      },
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o': {
        summary: 'New summary',
        videoTitle: 'Test Video',
        modelId: 'openai/gpt-4o',
        timestamp: 2000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ summary: string; timestamp: number }>;
    };

    expect(setCall.accordionItems).toHaveLength(1);
    expect(setCall.accordionItems[0]!.summary).toBe('New summary');
    expect(setCall.accordionItems[0]!.timestamp).toBe(2000);
  });

  it('should handle malformed cache keys gracefully', async () => {
    // Video ID must be exactly 11 characters
    const oldCache = {
      'invalid_key': {
        summary: 'Invalid',
        videoTitle: 'Invalid',
        modelId: 'model',
        timestamp: 1000,
      },
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o': {
        summary: 'Valid summary',
        videoTitle: 'Valid Video',
        modelId: 'openai/gpt-4o',
        timestamp: 2000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ summary: string }>;
    };

    // Should only have the valid entry
    expect(setCall.accordionItems).toHaveLength(1);
    expect(setCall.accordionItems[0]!.summary).toBe('Valid summary');
  });

  it('should use "Unknown Prompt" when prompt not found', async () => {
    mockGetPromptById.mockResolvedValue(null);

    // Video ID must be exactly 11 characters
    const oldCache = {
      'dQw4w9WgXcQ_deleted-prompt_openai/gpt-4o': {
        summary: 'Summary',
        videoTitle: 'Video',
        modelId: 'openai/gpt-4o',
        timestamp: 1000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ promptName: string }>;
    };

    expect(setCall.accordionItems[0]!.promptName).toBe('Unknown Prompt');
  });

  it('should merge with existing accordion items', async () => {
    // Video IDs must be exactly 11 characters
    const existingItems = [
      {
        id: 'xxxxxxxxxxx_prompt1',
        videoId: 'xxxxxxxxxxx',
        videoTitle: 'Existing Video',
        videoUrl: 'https://www.youtube.com/watch?v=xxxxxxxxxxx',
        promptId: 'prompt1',
        promptName: 'Test Prompt',
        modelId: 'openai/gpt-4o',
        summary: 'Existing summary',
        timestamp: 3000,
      },
    ];

    const oldCache = {
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o': {
        summary: 'Migrated summary',
        videoTitle: 'Migrated Video',
        modelId: 'openai/gpt-4o',
        timestamp: 2000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
      accordionItems: existingItems,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ id: string }>;
    };

    expect(setCall.accordionItems).toHaveLength(2);
    // Should be sorted by timestamp descending
    expect(setCall.accordionItems[0]!.id).toBe('xxxxxxxxxxx_prompt1');
    expect(setCall.accordionItems[1]!.id).toBe('dQw4w9WgXcQ_prompt1');
  });

  it('should not duplicate existing items', async () => {
    // Video IDs must be exactly 11 characters
    const existingItems = [
      {
        id: 'dQw4w9WgXcQ_prompt1',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Existing',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        promptId: 'prompt1',
        promptName: 'Test',
        modelId: 'openai/gpt-4o',
        summary: 'Existing summary',
        timestamp: 3000,
      },
    ];

    const oldCache = {
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o': {
        summary: 'Migrated summary',
        videoTitle: 'Migrated',
        modelId: 'openai/gpt-4o',
        timestamp: 2000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
      accordionItems: existingItems,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ id: string; summary: string }>;
    };

    // Should only have the existing item (not duplicated)
    expect(setCall.accordionItems).toHaveLength(1);
    expect(setCall.accordionItems[0]!.summary).toBe('Existing summary');
  });

  it('should remove old cache after migration', async () => {
    // Video ID must be exactly 11 characters
    const oldCache = {
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o': {
        summary: 'Summary',
        videoTitle: 'Video',
        modelId: 'openai/gpt-4o',
        timestamp: 1000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('summaryCache');
  });

  it('should construct correct video URL', async () => {
    const oldCache = {
      'dQw4w9WgXcQ_prompt1_openai/gpt-4o': {
        summary: 'Summary',
        videoTitle: 'Video',
        modelId: 'openai/gpt-4o',
        timestamp: 1000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ videoUrl: string }>;
    };

    expect(setCall.accordionItems[0]!.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('should handle system-default prompt ID', async () => {
    // Video ID must be exactly 11 characters
    const oldCache = {
      'dQw4w9WgXcQ_system-default_openai/gpt-4o': {
        summary: 'Summary',
        videoTitle: 'Video',
        modelId: 'openai/gpt-4o',
        timestamp: 1000,
      },
    };

    chromeMock.storage.local.get.mockResolvedValue({
      summaryCache: oldCache,
    });

    await migrateOldCache();

    const setCall = chromeMock.storage.local.set.mock.calls[0]![0] as {
      accordionItems: Array<{ promptId: string }>;
    };

    expect(setCall.accordionItems[0]!.promptId).toBe('system-default');
  });
});
