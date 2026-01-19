import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PromptSelector } from '../../../src/side-panel/components/PromptSelector';
import { SYSTEM_PROMPT_ID } from '../../../src/types/prompt';
import type { Prompt } from '../../../src/types/prompt';

// Mock promptStorage
const mockGetPrompts = vi.fn();
vi.mock('../../../src/utils/promptStorage', () => ({
  getPrompts: () => mockGetPrompts(),
}));

// Mock chrome storage API
const mockAddListener = vi.fn();
const mockRemoveListener = vi.fn();

vi.stubGlobal('chrome', {
  storage: {
    local: {
      onChanged: {
        addListener: mockAddListener,
        removeListener: mockRemoveListener,
      },
    },
  },
});

const defaultPrompts: Prompt[] = [
  { id: SYSTEM_PROMPT_ID, name: 'Default Summary', text: 'Default prompt', model: 'openai/gpt-4o-mini', isDefault: true, isSystem: true },
  { id: 'custom-1', name: 'Custom Prompt', text: 'Custom content', model: 'openai/gpt-4o-mini', isDefault: false, isSystem: false },
];

const defaultProps = {
  value: SYSTEM_PROMPT_ID,
  onChange: vi.fn(),
  disabled: false,
};

describe('PromptSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrompts.mockResolvedValue(defaultPrompts);
  });

  describe('rendering', () => {
    it('should render a select element', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should load prompts on mount', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetPrompts).toHaveBeenCalled();
      });
    });

    it('should display prompts in select dropdown', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Default Summary (Default)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Custom Prompt' })).toBeInTheDocument();
      });
    });

    it('should show (Default) suffix for default prompt', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        const defaultOption = screen.getByRole('option', { name: /Default Summary/ });
        expect(defaultOption).toHaveTextContent('(Default)');
      });
    });

    it('should not show (Default) suffix for non-default prompts', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        const customOption = screen.getByRole('option', { name: 'Custom Prompt' });
        expect(customOption).not.toHaveTextContent('(Default)');
      });
    });
  });

  describe('selection', () => {
    it('should have the provided value selected', async () => {
      render(<PromptSelector {...defaultProps} value="custom-1" />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('custom-1');
      });
    });

    it('should call onChange with promptId and modelId when selection changes', async () => {
      const onChange = vi.fn();
      render(<PromptSelector {...defaultProps} onChange={onChange} />);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Custom Prompt' })).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom-1' } });

      // Should be called with promptId and the prompt's model
      expect(onChange).toHaveBeenCalledWith('custom-1', 'openai/gpt-4o-mini');
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', async () => {
      render(<PromptSelector {...defaultProps} disabled={true} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeDisabled();
      });
    });

    it('should be enabled when disabled prop is false', async () => {
      render(<PromptSelector {...defaultProps} disabled={false} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });
    });
  });

  describe('storage listener', () => {
    it('should register storage listener on mount', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalled();
      });
    });

    it('should unregister storage listener on unmount', async () => {
      const { unmount } = render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemoveListener).toHaveBeenCalled();
    });

    it('should reload prompts when storage changes', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalled();
      });

      const listener = mockAddListener.mock.calls[0]![0] as (changes: Record<string, unknown>) => void;
      mockGetPrompts.mockClear();

      await act(async () => {
        listener({ prompts: { newValue: [] } });
      });

      expect(mockGetPrompts).toHaveBeenCalled();
    });

    it('should not reload prompts for unrelated storage changes', async () => {
      render(<PromptSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockAddListener).toHaveBeenCalled();
      });

      const listener = mockAddListener.mock.calls[0]![0] as (changes: Record<string, unknown>) => void;
      mockGetPrompts.mockClear();

      await act(async () => {
        listener({ someOtherKey: { newValue: 'test' } });
      });

      expect(mockGetPrompts).not.toHaveBeenCalled();
    });
  });
});
