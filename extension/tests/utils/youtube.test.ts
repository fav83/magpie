import { describe, it, expect } from 'vitest';
import { extractVideoId, isYouTubeVideoUrl } from '../../src/utils/youtube';

describe('extractVideoId', () => {
  it('should extract video ID from standard YouTube URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('should extract video ID from URL with additional parameters', () => {
    expect(
      extractVideoId('https://www.youtube.com/watch?v=abc123&t=120&list=PLxyz')
    ).toBe('abc123');
  });

  it('should extract video ID from URL without www', () => {
    expect(extractVideoId('https://youtube.com/watch?v=test123')).toBe(
      'test123'
    );
  });

  it('should extract video ID from URL with http', () => {
    expect(extractVideoId('http://www.youtube.com/watch?v=video456')).toBe(
      'video456'
    );
  });

  it('should return empty string for YouTube homepage', () => {
    expect(extractVideoId('https://www.youtube.com/')).toBe('');
  });

  it('should return empty string for YouTube channel page', () => {
    expect(extractVideoId('https://www.youtube.com/channel/UCxyz')).toBe('');
  });

  it('should return empty string for non-YouTube URL', () => {
    expect(extractVideoId('https://google.com/')).toBe('');
  });

  it('should return empty string for invalid URL', () => {
    expect(extractVideoId('not a url')).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(extractVideoId('')).toBe('');
  });

  it('should handle URL with v parameter but no value', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=')).toBe('');
  });
});

describe('isYouTubeVideoUrl', () => {
  it('should return true for standard YouTube video URL', () => {
    expect(isYouTubeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      true
    );
  });

  it('should return true for URL with additional parameters', () => {
    expect(
      isYouTubeVideoUrl('https://www.youtube.com/watch?v=abc&t=120')
    ).toBe(true);
  });

  it('should return true for URL without www', () => {
    expect(isYouTubeVideoUrl('https://youtube.com/watch?v=test')).toBe(true);
  });

  it('should return true for http URL', () => {
    expect(isYouTubeVideoUrl('http://youtube.com/watch?v=test')).toBe(true);
  });

  it('should return false for YouTube homepage', () => {
    expect(isYouTubeVideoUrl('https://www.youtube.com/')).toBe(false);
  });

  it('should return false for YouTube channel page', () => {
    expect(isYouTubeVideoUrl('https://www.youtube.com/channel/UCxyz')).toBe(
      false
    );
  });

  it('should return false for YouTube shorts URL', () => {
    expect(isYouTubeVideoUrl('https://www.youtube.com/shorts/abc123')).toBe(
      false
    );
  });

  it('should return false for non-YouTube URL', () => {
    expect(isYouTubeVideoUrl('https://google.com/')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isYouTubeVideoUrl('')).toBe(false);
  });
});
