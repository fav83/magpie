import { describe, it, expect } from 'vitest';
import { formatChatConversation, formatChatForShare } from '../../src/utils/formatChat';
import type { ChatMessage } from '../../src/types/chat';

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: `${role}-${content.slice(0, 8)}`, role, content, status: 'complete' };
}

describe('formatChatConversation', () => {
  it('formats a single user message', () => {
    const messages = [msg('user', 'Hello')];
    expect(formatChatConversation(messages)).toBe('You: Hello');
  });

  it('formats a single assistant message', () => {
    const messages = [msg('assistant', 'Hi there')];
    expect(formatChatConversation(messages)).toBe('Assistant: Hi there');
  });

  it('formats a multi-turn conversation with double newlines', () => {
    const messages = [
      msg('user', 'What is this about?'),
      msg('assistant', 'It is about testing.'),
      msg('user', 'Thanks!'),
    ];
    expect(formatChatConversation(messages)).toBe(
      'You: What is this about?\n\nAssistant: It is about testing.\n\nYou: Thanks!'
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatChatConversation([])).toBe('');
  });

  it('preserves multiline content within a message', () => {
    const messages = [msg('assistant', 'Line 1\nLine 2\nLine 3')];
    expect(formatChatConversation(messages)).toBe('Assistant: Line 1\nLine 2\nLine 3');
  });

  it('does not add markdown bold formatting', () => {
    const messages = [msg('user', 'test')];
    const result = formatChatConversation(messages);
    expect(result).not.toContain('**');
  });
});

describe('formatChatForShare', () => {
  it('formats a single user message with markdown bold', () => {
    const messages = [msg('user', 'Hello')];
    expect(formatChatForShare(messages)).toBe('**You:** Hello');
  });

  it('formats a single assistant message with markdown bold', () => {
    const messages = [msg('assistant', 'Hi there')];
    expect(formatChatForShare(messages)).toBe('**Assistant:** Hi there');
  });

  it('formats a multi-turn conversation with double newlines', () => {
    const messages = [
      msg('user', 'Question?'),
      msg('assistant', 'Answer.'),
    ];
    expect(formatChatForShare(messages)).toBe(
      '**You:** Question?\n\n**Assistant:** Answer.'
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatChatForShare([])).toBe('');
  });

  it('preserves multiline content within a message', () => {
    const messages = [msg('assistant', 'Line 1\nLine 2')];
    expect(formatChatForShare(messages)).toBe('**Assistant:** Line 1\nLine 2');
  });

  it('includes markdown bold markers', () => {
    const messages = [msg('user', 'test')];
    const result = formatChatForShare(messages);
    expect(result).toContain('**You:**');
  });
});
