import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatShareText, shareSummary, copySummary } from '../../src/services/shareSummary';
import type { ShareContent } from '../../src/services/shareSummary';

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(),
  },
}));

import { Share } from '@capacitor/share';

const mockShare = vi.mocked(Share.share);

const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
});

beforeEach(() => {
  mockShare.mockReset();
  mockWriteText.mockReset();
});

const content: ShareContent = {
  title: 'My Video Title',
  summary: '## Summary\n\n- Point one\n- Point two',
  url: 'https://www.youtube.com/watch?v=abc123',
};

describe('formatShareText', () => {
  it('formats title + summary + URL with double newline separators', () => {
    const result = formatShareText(content);
    expect(result).toBe(
      'My Video Title\n\n## Summary\n\n- Point one\n- Point two\n\nhttps://www.youtube.com/watch?v=abc123'
    );
  });

  it('handles empty title gracefully', () => {
    const result = formatShareText({ ...content, title: '' });
    expect(result).toBe(
      '\n\n## Summary\n\n- Point one\n- Point two\n\nhttps://www.youtube.com/watch?v=abc123'
    );
  });

  it('preserves Markdown formatting in summary', () => {
    const mdContent: ShareContent = {
      title: 'Title',
      summary: '**bold** and _italic_ and `code`',
      url: 'https://youtu.be/xyz',
    };
    const result = formatShareText(mdContent);
    expect(result).toContain('**bold** and _italic_ and `code`');
  });
});

describe('shareSummary', () => {
  it('calls Share.share() with structured title, text, url fields', async () => {
    mockShare.mockResolvedValue({ activityType: undefined } as never);

    await shareSummary(content);

    expect(mockShare).toHaveBeenCalledWith({
      title: 'My Video Title',
      text: '## Summary\n\n- Point one\n- Point two',
      url: 'https://www.youtube.com/watch?v=abc123',
      dialogTitle: 'Share Summary',
    });
  });

  it('does not throw when Share.share() rejects (user cancel)', async () => {
    mockShare.mockRejectedValue(new Error('User cancelled'));

    await expect(shareSummary(content)).resolves.toBeUndefined();
  });

  it('does not throw when plugin is unavailable', async () => {
    mockShare.mockRejectedValue(new Error('Plugin not available'));

    await expect(shareSummary(content)).resolves.toBeUndefined();
  });
});

describe('copySummary', () => {
  it('calls navigator.clipboard.writeText() with formatted text', async () => {
    mockWriteText.mockResolvedValue(undefined);

    await copySummary(content);

    expect(mockWriteText).toHaveBeenCalledWith(formatShareText(content));
  });

  it('returns true on success', async () => {
    mockWriteText.mockResolvedValue(undefined);

    const result = await copySummary(content);
    expect(result).toBe(true);
  });

  it('returns false when clipboard API throws', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard access denied'));

    const result = await copySummary(content);
    expect(result).toBe(false);
  });
});
