import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTimestamp } from '../../src/utils/formatTimestamp';

describe('formatTimestamp', () => {
  const NOW = 1704067200000; // Jan 1, 2024, 00:00:00 UTC

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('seconds ago', () => {
    it('should return "Just now" for timestamps less than 60 seconds ago', () => {
      expect(formatTimestamp(NOW - 1000)).toBe('Just now');
      expect(formatTimestamp(NOW - 30000)).toBe('Just now');
      expect(formatTimestamp(NOW - 59000)).toBe('Just now');
    });

    it('should return "Just now" for current timestamp', () => {
      expect(formatTimestamp(NOW)).toBe('Just now');
    });
  });

  describe('minutes ago', () => {
    it('should return "1 min ago" for 1 minute', () => {
      expect(formatTimestamp(NOW - 60 * 1000)).toBe('1 min ago');
    });

    it('should return correct minutes for various times', () => {
      expect(formatTimestamp(NOW - 2 * 60 * 1000)).toBe('2 min ago');
      expect(formatTimestamp(NOW - 30 * 60 * 1000)).toBe('30 min ago');
      expect(formatTimestamp(NOW - 59 * 60 * 1000)).toBe('59 min ago');
    });
  });

  describe('hours ago', () => {
    it('should return "1 hour ago" for 1 hour', () => {
      expect(formatTimestamp(NOW - 60 * 60 * 1000)).toBe('1 hour ago');
    });

    it('should return "2 hours ago" with plural', () => {
      expect(formatTimestamp(NOW - 2 * 60 * 60 * 1000)).toBe('2 hours ago');
    });

    it('should return correct hours for various times', () => {
      expect(formatTimestamp(NOW - 5 * 60 * 60 * 1000)).toBe('5 hours ago');
      expect(formatTimestamp(NOW - 23 * 60 * 60 * 1000)).toBe('23 hours ago');
    });
  });

  describe('days ago', () => {
    it('should return "1 day ago" for 1 day', () => {
      expect(formatTimestamp(NOW - 24 * 60 * 60 * 1000)).toBe('1 day ago');
    });

    it('should return "2 days ago" with plural', () => {
      expect(formatTimestamp(NOW - 2 * 24 * 60 * 60 * 1000)).toBe('2 days ago');
    });

    it('should return correct days up to 6 days', () => {
      expect(formatTimestamp(NOW - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
      expect(formatTimestamp(NOW - 6 * 24 * 60 * 60 * 1000)).toBe('6 days ago');
    });
  });

  describe('formatted date', () => {
    it('should return formatted date for 7 days or more', () => {
      const sevenDaysAgo = NOW - 7 * 24 * 60 * 60 * 1000;
      const result = formatTimestamp(sevenDaysAgo);
      expect(result).toMatch(/Dec 25, 2023/);
    });

    it('should return formatted date for older timestamps', () => {
      const thirtyDaysAgo = NOW - 30 * 24 * 60 * 60 * 1000;
      const result = formatTimestamp(thirtyDaysAgo);
      expect(result).toMatch(/Dec 2, 2023/);
    });

    it('should return formatted date for previous year', () => {
      const oneYearAgo = NOW - 365 * 24 * 60 * 60 * 1000;
      const result = formatTimestamp(oneYearAgo);
      expect(result).toMatch(/2023/);
    });
  });

  describe('edge cases', () => {
    it('should handle boundary between minutes and hours', () => {
      expect(formatTimestamp(NOW - 59 * 60 * 1000)).toBe('59 min ago');
      expect(formatTimestamp(NOW - 60 * 60 * 1000)).toBe('1 hour ago');
    });

    it('should handle boundary between hours and days', () => {
      expect(formatTimestamp(NOW - 23 * 60 * 60 * 1000)).toBe('23 hours ago');
      expect(formatTimestamp(NOW - 24 * 60 * 60 * 1000)).toBe('1 day ago');
    });

    it('should handle boundary between days and formatted date', () => {
      expect(formatTimestamp(NOW - 6 * 24 * 60 * 60 * 1000)).toBe('6 days ago');
      const sevenDaysResult = formatTimestamp(NOW - 7 * 24 * 60 * 60 * 1000);
      expect(sevenDaysResult).not.toContain('days ago');
    });
  });
});
