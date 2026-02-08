import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkShareIntent } from '../../src/services/shareIntent';

vi.mock('send-intent', () => ({
  SendIntent: {
    checkSendIntentReceived: vi.fn(),
  },
}));

import { SendIntent } from 'send-intent';
const mockCheck = vi.mocked(SendIntent.checkSendIntentReceived);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkShareIntent', () => {
  it('returns youtube URL when intent contains valid YouTube URL', async () => {
    mockCheck.mockResolvedValue({ url: 'https://youtu.be/abc123' });
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'youtube', url: 'https://youtu.be/abc123' });
  });

  it('returns no-youtube when intent URL is not a YouTube URL', async () => {
    mockCheck.mockResolvedValue({ url: 'https://example.com/page' });
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'no-youtube' });
  });

  it('returns none when intent has no URL', async () => {
    mockCheck.mockResolvedValue({});
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'none' });
  });

  it('returns none when plugin throws (e.g., web environment)', async () => {
    mockCheck.mockRejectedValue(new Error('Not available'));
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'none' });
  });

  it('extracts YouTube URL from intent text containing extra content', async () => {
    mockCheck.mockResolvedValue({
      url: 'Check this out: https://www.youtube.com/watch?v=xyz789 great video',
    });
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'youtube', url: 'https://www.youtube.com/watch?v=xyz789' });
  });

  it('extracts YouTube URL from title + URL format (YouTube app share)', async () => {
    mockCheck.mockResolvedValue({
      url: 'Rick Astley - Never Gonna Give You Up\nhttps://youtu.be/dQw4w9WgXcQ',
    });
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' });
  });

  it('returns none when result is null', async () => {
    mockCheck.mockResolvedValue(null);
    const result = await checkShareIntent();
    expect(result).toEqual({ kind: 'none' });
  });
});
