import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFontSize } from '../../src/hooks/useFontSize';
import { setupChromeMock, resetChromeMock, chromeMock } from '../mocks/chrome';
import { FONT_SIZE, STORAGE_KEYS } from '../../src/config';

setupChromeMock();

describe('useFontSize', () => {
  beforeEach(() => {
    resetChromeMock();
  });

  describe('with numeric values', () => {
    it('should return stored numeric value', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 14,
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT); // Initial before async resolves
    });

    it('should clamp values below minimum', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 2,
      });

      const { result } = renderHook(() => useFontSize());
      // Before storage resolves, returns default
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should clamp values above maximum', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 50,
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });
  });

  describe('with legacy string values', () => {
    it('should migrate "small" to 10px', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 'small',
      });

      const { result } = renderHook(() => useFontSize());
      // Before async resolves, returns default (since string !== number default)
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should migrate "medium" to 12px', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 'medium',
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should migrate "large" to 14px', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 'large',
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should handle numeric strings', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: '16',
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should return default for unknown string values', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: 'unknown',
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });
  });

  describe('with invalid values', () => {
    it('should return default for null', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: null,
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should return default for undefined', () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });

    it('should return default for NaN', () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.FONT_SIZE]: NaN,
      });

      const { result } = renderHook(() => useFontSize());
      expect(result.current).toBe(FONT_SIZE.DEFAULT);
    });
  });
});
