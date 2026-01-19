import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatSettings } from '../../../src/options/components/ChatSettings';
import { DEFAULT_CHAT_SYSTEM_PROMPT } from '../../../src/config';
import { setupChromeMock, resetChromeMock } from '../../mocks/chrome';

describe('ChatSettings', () => {
  beforeEach(() => {
    setupChromeMock();
    resetChromeMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should render Chat Settings title', () => {
    render(<ChatSettings />);

    expect(screen.getByText('Chat Settings')).toBeInTheDocument();
  });

  it('should render Chat System Prompt label', () => {
    render(<ChatSettings />);

    expect(screen.getByText('Chat System Prompt')).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<ChatSettings />);

    expect(
      screen.getByText(/This prompt is used when chatting with video transcripts/)
    ).toBeInTheDocument();
  });

  it('should render textarea with default prompt', () => {
    render(<ChatSettings />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(DEFAULT_CHAT_SYSTEM_PROMPT);
  });

  it('should render Save button', () => {
    render(<ChatSettings />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('should disable Save button when no changes', () => {
    render(<ChatSettings />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('should enable Save button when text changes', () => {
    render(<ChatSettings />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New prompt text' } });

    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });


  it('should show Saved! message after saving', () => {
    render(<ChatSettings />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New prompt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('should hide Saved! message after 2 seconds', () => {
    render(<ChatSettings />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New prompt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Saved!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

});
