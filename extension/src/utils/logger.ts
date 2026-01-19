// Enable logging in development mode (when built with --mode development) or test mode
// Note: import.meta.env.DEV is only true for vite dev server, not vite build --mode development
const ENABLE_LOGGING = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';

// Debug logging can be enabled at runtime via chrome.storage.local.set({ DEBUG_LOGGING: true })
// This allows debugging in production builds
let debugLoggingEnabled = false;

// Try to load debug logging setting (async, so logs before this completes use default)
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for non-extension contexts
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.get(['DEBUG_LOGGING']).then((result) => {
    debugLoggingEnabled = result.DEBUG_LOGGING === true;
    if (debugLoggingEnabled) {
      console.log('[YT-Summarizer] Debug logging enabled via storage');
    }
  }).catch(() => {
    // Ignore errors (e.g., in content scripts without storage access)
  });
}

function shouldLog(): boolean {
  return ENABLE_LOGGING || debugLoggingEnabled;
}

export function log(...args: unknown[]): void {
  if (shouldLog()) {
    console.log('[YT-Summarizer]', ...args);
  }
}

export function logError(...args: unknown[]): void {
  if (shouldLog()) {
    console.error('[YT-Summarizer]', ...args);
  }
}

export function logWarn(...args: unknown[]): void {
  if (shouldLog()) {
    console.warn('[YT-Summarizer]', ...args);
  }
}

/**
 * Log with a specific component tag for easier filtering
 */
export function logComponent(component: string, ...args: unknown[]): void {
  if (shouldLog()) {
    console.log(`[YT-Summarizer][${component}]`, ...args);
  }
}

/**
 * Performance logging - tracks operation timing
 * Returns an object with an end() method to log completion time
 */
export function logPerformance(component: string, operation: string): { end: () => void } {
  if (!shouldLog()) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op in production
    return { end: () => {} };
  }
  const startTime = performance.now();
  console.log(`[YT-Summarizer][${component}][PERF] START: ${operation}`);
  return {
    end: () => {
      const duration = performance.now() - startTime;
      console.log(`[YT-Summarizer][${component}][PERF] END: ${operation} - ${duration.toFixed(2)}ms`);
    }
  };
}

/**
 * Log a performance measurement inline (when you already have start/end times)
 */
export function logTiming(component: string, operation: string, durationMs: number): void {
  if (shouldLog()) {
    console.log(`[YT-Summarizer][${component}][PERF] ${operation}: ${durationMs.toFixed(2)}ms`);
  }
}

/**
 * Enable debug logging at runtime (useful for debugging in production)
 */
export async function enableDebugLogging(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for non-extension contexts
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ DEBUG_LOGGING: true });
    debugLoggingEnabled = true;
    console.log('[YT-Summarizer] Debug logging enabled');
  }
}

/**
 * Disable debug logging at runtime
 */
export async function disableDebugLogging(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for non-extension contexts
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove('DEBUG_LOGGING');
    debugLoggingEnabled = false;
    console.log('[YT-Summarizer] Debug logging disabled');
  }
}
