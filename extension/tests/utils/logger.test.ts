import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the logger with different DEV values
// Since import.meta.env.DEV is set at build time, we'll test the behavior directly

describe('logger', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.resetModules();
  });

  describe('log', () => {
    it('should prefix messages with [YT-Summarizer]', async () => {
      const { log } = await import('../../src/utils/logger');
      log('test message');

      // In test environment, DEV is true
      expect(console.log).toHaveBeenCalledWith('[YT-Summarizer]', 'test message');
    });

    it('should pass multiple arguments', async () => {
      const { log } = await import('../../src/utils/logger');
      log('message', { key: 'value' }, 123);

      expect(console.log).toHaveBeenCalledWith(
        '[YT-Summarizer]',
        'message',
        { key: 'value' },
        123
      );
    });
  });

  describe('logError', () => {
    it('should always log errors with prefix', async () => {
      const { logError } = await import('../../src/utils/logger');
      logError('error message');

      expect(console.error).toHaveBeenCalledWith('[YT-Summarizer]', 'error message');
    });

    it('should pass error objects', async () => {
      const { logError } = await import('../../src/utils/logger');
      const error = new Error('test error');
      logError('Something failed:', error);

      expect(console.error).toHaveBeenCalledWith(
        '[YT-Summarizer]',
        'Something failed:',
        error
      );
    });
  });

  describe('logWarn', () => {
    it('should prefix warnings with [YT-Summarizer]', async () => {
      const { logWarn } = await import('../../src/utils/logger');
      logWarn('warning message');

      // In test environment, DEV is true
      expect(console.warn).toHaveBeenCalledWith('[YT-Summarizer]', 'warning message');
    });

    it('should pass multiple arguments', async () => {
      const { logWarn } = await import('../../src/utils/logger');
      logWarn('warning', 'details', 42);

      expect(console.warn).toHaveBeenCalledWith(
        '[YT-Summarizer]',
        'warning',
        'details',
        42
      );
    });
  });
});
