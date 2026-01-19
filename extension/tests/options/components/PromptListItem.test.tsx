import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptListItem } from '../../../src/options/components/PromptListItem';
import type { Prompt } from '../../../src/types/prompt';

describe('PromptListItem', () => {
  const createPrompt = (overrides?: Partial<Prompt>): Prompt => ({
    id: 'prompt-1',
    name: 'Test Prompt',
    text: 'Test text with {transcript}',
    model: 'openai/gpt-4o-mini',
    isSystem: false,
    isDefault: false,
    ...overrides,
  });

  const defaultProps = {
    prompt: createPrompt(),
    isSelected: false,
    isDirty: false,
    onClick: vi.fn(),
  };

  it('should render prompt name', () => {
    render(<PromptListItem {...defaultProps} />);

    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    render(<PromptListItem {...defaultProps} />);

    fireEvent.click(screen.getByRole('option'));

    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('should have aria-selected true when selected', () => {
    render(<PromptListItem {...defaultProps} isSelected={true} />);

    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });

  it('should have aria-selected false when not selected', () => {
    render(<PromptListItem {...defaultProps} isSelected={false} />);

    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
  });

  it('should show dirty indicator when isDirty is true', () => {
    render(<PromptListItem {...defaultProps} isDirty={true} />);

    expect(screen.getByTitle('Unsaved changes')).toBeInTheDocument();
  });

  it('should not show dirty indicator when isDirty is false', () => {
    render(<PromptListItem {...defaultProps} isDirty={false} />);

    expect(screen.queryByTitle('Unsaved changes')).not.toBeInTheDocument();
  });

  it('should show Default badge when prompt is default', () => {
    const prompt = createPrompt({ isDefault: true });
    render(<PromptListItem {...defaultProps} prompt={prompt} />);

    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('should show System badge when prompt is system', () => {
    const prompt = createPrompt({ isSystem: true });
    render(<PromptListItem {...defaultProps} prompt={prompt} />);

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should show both badges when prompt is both default and system', () => {
    const prompt = createPrompt({ isDefault: true, isSystem: true });
    render(<PromptListItem {...defaultProps} prompt={prompt} />);

    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should not show badges for regular prompts', () => {
    render(<PromptListItem {...defaultProps} />);

    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });
});
