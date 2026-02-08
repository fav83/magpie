import { describe, it, expect } from 'vitest';
import { extractVideoId, isValidYouTubeUrl, extractYouTubeUrl } from '../../src/utils/youtube';

describe('extractVideoId', () => {
  it('extracts ID from standard youtube.com URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from youtube.com without www', () => {
    expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from m.youtube.com', () => {
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID when URL has extra query params', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from youtu.be with trailing path', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });

  it('returns empty string for URL without v param', () => {
    expect(extractVideoId('https://www.youtube.com/watch')).toBe('');
  });

  it('returns empty string for invalid URL', () => {
    expect(extractVideoId('not a url')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractVideoId('')).toBe('');
  });
});

describe('isValidYouTubeUrl', () => {
  it('accepts www.youtube.com/watch?v=...', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('accepts youtube.com/watch?v=...', () => {
    expect(isValidYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('accepts m.youtube.com/watch?v=...', () => {
    expect(isValidYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('accepts youtu.be short URLs', () => {
    expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('rejects non-YouTube URLs', () => {
    expect(isValidYouTubeUrl('https://example.com/watch?v=abc')).toBe(false);
  });

  it('rejects youtube.com without /watch path', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/channel/UCxyz')).toBe(false);
  });

  it('rejects youtube.com/watch without v param', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch')).toBe(false);
  });

  it('rejects youtu.be with no path', () => {
    expect(isValidYouTubeUrl('https://youtu.be/')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidYouTubeUrl('')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isValidYouTubeUrl('not a url')).toBe(false);
  });
});

describe('extractYouTubeUrl', () => {
  it('extracts URL from plain YouTube URL string', () => {
    expect(extractYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
  });

  it('extracts URL from title + youtu.be format', () => {
    expect(extractYouTubeUrl('Video Title\nhttps://youtu.be/abc123')).toBe(
      'https://youtu.be/abc123'
    );
  });

  it('extracts URL from text with surrounding content', () => {
    expect(
      extractYouTubeUrl("Check this out https://www.youtube.com/watch?v=abc123 it's great")
    ).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('returns null for text with no YouTube URL', () => {
    expect(extractYouTubeUrl('Just some random text with no URLs')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractYouTubeUrl('')).toBeNull();
  });

  it('handles youtu.be short URL', () => {
    expect(extractYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://youtu.be/dQw4w9WgXcQ'
    );
  });

  it('handles m.youtube.com URL', () => {
    expect(extractYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ'
    );
  });

  it('returns first URL when multiple YouTube URLs are present', () => {
    expect(
      extractYouTubeUrl('https://youtu.be/first123 and https://youtu.be/second456')
    ).toBe('https://youtu.be/first123');
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeUrl('https://example.com/watch?v=abc123')).toBeNull();
  });

  it('handles http:// URLs', () => {
    expect(extractYouTubeUrl('http://www.youtube.com/watch?v=abc123')).toBe(
      'http://www.youtube.com/watch?v=abc123'
    );
  });
});
