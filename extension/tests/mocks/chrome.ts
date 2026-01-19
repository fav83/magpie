import { vi, type Mock } from 'vitest';

/**
 * Type for vi.fn() mock functions - use this for typed mock declarations.
 * Example: `sendMessage: MockFn` instead of `sendMessage: ReturnType<typeof vi.fn>`
 */
export type MockFn = Mock;

/**
 * Creates a typed mock function. Shorthand for vi.fn() with explicit typing.
 */
export function createMockFn<T extends (...args: unknown[]) => unknown>(): Mock<T> {
  return vi.fn() as Mock<T>;
}

/**
 * Comprehensive Chrome API mock for tests
 */
export const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(() => ({
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      disconnect: vi.fn(),
      name: 'streaming',
    })),
    onMessage: {
      addListener: vi.fn(),
    },
    onConnect: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    get: vi.fn(),
    query: vi.fn(),
    sendMessage: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  webNavigation: {
    onHistoryStateUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn(),
  },
};

/**
 * Setup Chrome mock globally. Call in test setup or beforeEach.
 */
export function setupChromeMock(): void {
  vi.stubGlobal('chrome', chromeMock);
}

/**
 * Reset all Chrome mock functions to default behavior.
 * Call in beforeEach after setupChromeMock.
 */
export function resetChromeMock(): void {
  // Reset all mocks
  vi.clearAllMocks();

  // Restore default resolved values
  chromeMock.storage.local.get.mockResolvedValue({});
  chromeMock.storage.local.set.mockResolvedValue(undefined);
  chromeMock.storage.local.remove.mockResolvedValue(undefined);
}

/**
 * Helper to simulate storage changes for testing storage listeners
 */
export function triggerStorageChange(changes: Record<string, { newValue?: unknown; oldValue?: unknown }>): void {
  const listeners = chromeMock.storage.local.onChanged.addListener.mock.calls;
  for (const [listener] of listeners) {
    if (typeof listener === 'function') {
      listener(changes);
    }
  }
}
