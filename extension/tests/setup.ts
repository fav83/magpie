import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { chromeMock } from './mocks/chrome';

// Mock chrome API globally
vi.stubGlobal('chrome', chromeMock);

// Cleanup after each test to prevent memory leaks
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.clearAllMocks();
});
