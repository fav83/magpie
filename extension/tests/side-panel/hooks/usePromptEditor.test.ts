import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptEditor } from '../../../src/side-panel/hooks/usePromptEditor';

// Mock promptStorage
const mockGetPromptById = vi.fn();
const mockAddPrompt = vi.fn();
const mockUpdatePrompt = vi.fn();

vi.mock('../../../src/utils/promptStorage', () => ({
  getPromptById: (id: string) => mockGetPromptById(id),
  addPrompt: (name: string, text: string) => mockAddPrompt(name, text),
  updatePrompt: (id: string, updates: object) => mockUpdatePrompt(id, updates),
  validatePromptText: (text: string) => {
    if (text.includes('{transcript}')) {
      return { valid: true };
    }
    return { valid: false, error: 'Prompt must include {transcript} placeholder.' };
  },
}));

describe('usePromptEditor', () => {
  const defaultOptions = {
    promptId: 'prompt-1',
    customPromptText: undefined,
    onApply: vi.fn(),
    onUpdateOriginal: vi.fn(),
    onSaveAsNew: vi.fn(),
  };

  const mockPrompt = {
    id: 'prompt-1',
    name: 'Test Prompt',
    text: 'Summarize this: {transcript}',
    model: 'openai/gpt-4o-mini',
    isDefault: true,
    isSystem: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPromptById.mockResolvedValue(mockPrompt);
    mockAddPrompt.mockImplementation((name: string, text: string) =>
      Promise.resolve({ id: 'new-prompt-id', name, text, model: 'openai/gpt-4o-mini', isDefault: false, isSystem: false })
    );
    mockUpdatePrompt.mockResolvedValue(undefined);
  });

  describe('initial state', () => {
    it('should start with closed mode', () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      expect(result.current.state.mode).toBe('closed');
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.isSystemPrompt).toBe(false);
    });

    it('should have empty form state initially', () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      expect(result.current.form.promptText).toBe('');
      expect(result.current.form.newPromptName).toBe('');
    });
  });

  describe('opening editor', () => {
    it('should change mode to editing when opened', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      expect(result.current.state.mode).toBe('editing');
    });

    it('should load prompt text from storage', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).toBe('Summarize this: {transcript}');
      });
    });

    it('should use customPromptText if provided', async () => {
      const { result } = renderHook(() =>
        usePromptEditor({
          ...defaultOptions,
          customPromptText: 'Custom prompt with {transcript}',
        })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).toBe('Custom prompt with {transcript}');
      });
    });

    it('should set isSystemPrompt flag from loaded prompt', async () => {
      mockGetPromptById.mockResolvedValue({ ...mockPrompt, isSystem: true });

      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.state.isSystemPrompt).toBe(true);
      });
    });

    it('should set isLoading while loading', async () => {
      let resolvePromise: (value: unknown) => void;
      mockGetPromptById.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      expect(result.current.state.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!(mockPrompt);
      });

      expect(result.current.state.isLoading).toBe(false);
    });
  });

  describe('closing editor', () => {
    it('should change mode to closed', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.state.mode).toBe('editing');
      });

      act(() => {
        result.current.actions.close();
      });

      expect(result.current.state.mode).toBe('closed');
    });

    it('should clear form state on close', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.close();
      });

      expect(result.current.form.promptText).toBe('');
      expect(result.current.form.newPromptName).toBe('');
    });
  });

  describe('form updates', () => {
    it('should update promptText via setPromptText', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).toBe('Summarize this: {transcript}');
      });

      act(() => {
        result.current.form.setPromptText('New prompt with {transcript}');
      });

      expect(result.current.form.promptText).toBe('New prompt with {transcript}');
    });

    it('should update newPromptName via setNewPromptName', () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.form.setNewPromptName('My New Prompt');
      });

      expect(result.current.form.newPromptName).toBe('My New Prompt');
    });
  });

  describe('validation', () => {
    it('should be valid when prompt contains {transcript}', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).toBe('Summarize this: {transcript}');
      });

      expect(result.current.validation.isValid).toBe(true);
    });

    it('should be invalid when prompt does not contain {transcript}', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.form.setPromptText('Invalid prompt without placeholder');
      });

      expect(result.current.validation.isValid).toBe(false);
      expect(result.current.validation.error).toBe('Prompt must include {transcript} placeholder.');
    });

    it('should not show error if text has not been modified', async () => {
      mockGetPromptById.mockResolvedValue({ ...mockPrompt, text: 'Invalid prompt' });

      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).toBe('Invalid prompt');
      });

      // Error should not be shown since text hasn't been modified
      expect(result.current.validation.error).toBeUndefined();
    });
  });

  describe('apply action', () => {
    it('should call onApply with prompt text and close editor', async () => {
      const onApply = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onApply })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.apply();
      });

      expect(onApply).toHaveBeenCalledWith('Summarize this: {transcript}');
      expect(result.current.state.mode).toBe('closed');
    });

    it('should not apply if validation fails', async () => {
      const onApply = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onApply })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.form.setPromptText('Invalid prompt');
      });

      act(() => {
        result.current.actions.apply();
      });

      expect(onApply).not.toHaveBeenCalled();
      expect(result.current.state.mode).toBe('editing');
    });
  });

  describe('update action', () => {
    it('should call updatePrompt and onUpdateOriginal', async () => {
      const onUpdateOriginal = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onUpdateOriginal })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      await act(async () => {
        await result.current.actions.update();
      });

      expect(mockUpdatePrompt).toHaveBeenCalledWith('prompt-1', {
        text: 'Summarize this: {transcript}',
      });
      expect(onUpdateOriginal).toHaveBeenCalledWith('prompt-1');
      expect(result.current.state.mode).toBe('closed');
    });

    it('should not update if prompt is system prompt', async () => {
      mockGetPromptById.mockResolvedValue({ ...mockPrompt, isSystem: true });

      const onUpdateOriginal = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onUpdateOriginal })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.state.isSystemPrompt).toBe(true);
      });

      await act(async () => {
        await result.current.actions.update();
      });

      expect(mockUpdatePrompt).not.toHaveBeenCalled();
      expect(onUpdateOriginal).not.toHaveBeenCalled();
    });
  });

  describe('save new flow', () => {
    it('should switch to saving-new mode with default name', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
      });

      expect(result.current.state.mode).toBe('saving-new');
      expect(result.current.form.newPromptName).toBe('Copy of Test Prompt');
    });

    it('should confirm save new with valid name', async () => {
      const onSaveAsNew = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onSaveAsNew })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
      });

      await act(async () => {
        await result.current.actions.confirmSaveNew();
      });

      expect(mockAddPrompt).toHaveBeenCalledWith(
        'Copy of Test Prompt',
        'Summarize this: {transcript}'
      );
      expect(onSaveAsNew).toHaveBeenCalledWith('new-prompt-id');
      expect(result.current.state.mode).toBe('closed');
    });

    it('should not confirm if name is empty', async () => {
      const onSaveAsNew = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onSaveAsNew })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
        result.current.form.setNewPromptName('');
      });

      await act(async () => {
        await result.current.actions.confirmSaveNew();
      });

      expect(mockAddPrompt).not.toHaveBeenCalled();
      expect(onSaveAsNew).not.toHaveBeenCalled();
    });

    it('should go back to editing mode', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
      });

      expect(result.current.state.mode).toBe('saving-new');

      act(() => {
        result.current.actions.backFromSaveNew();
      });

      expect(result.current.state.mode).toBe('editing');
      expect(result.current.form.newPromptName).toBe('');
    });
  });

  describe('validation in saving-new mode', () => {
    it('should be invalid if name is empty in saving-new mode', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
        result.current.form.setNewPromptName('   ');
      });

      expect(result.current.validation.isValid).toBe(false);
    });

    it('should be valid if name has content in saving-new mode', async () => {
      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
      });

      // Default name should be set
      expect(result.current.form.newPromptName).toBe('Copy of Test Prompt');
      expect(result.current.validation.isValid).toBe(true);
    });
  });

  describe('operation errors', () => {
    it('should set operationError when update fails', async () => {
      mockUpdatePrompt.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      await act(async () => {
        await result.current.actions.update();
      });

      expect(result.current.validation.operationError).toBe('Network error');
      expect(result.current.state.mode).toBe('editing'); // Should stay open
    });

    it('should set operationError when confirmSaveNew fails', async () => {
      mockAddPrompt.mockRejectedValue(new Error('Storage full'));

      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      act(() => {
        result.current.actions.saveNew();
      });

      await act(async () => {
        await result.current.actions.confirmSaveNew();
      });

      expect(result.current.validation.operationError).toBe('Storage full');
      expect(result.current.state.mode).toBe('saving-new'); // Should stay open
    });

    it('should clear operationError when closing editor', async () => {
      mockUpdatePrompt.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePromptEditor(defaultOptions));

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      await act(async () => {
        await result.current.actions.update();
      });

      expect(result.current.validation.operationError).toBe('Network error');

      act(() => {
        result.current.actions.close();
      });

      expect(result.current.validation.operationError).toBeUndefined();
    });

    it('should clear operationError before retrying operation', async () => {
      mockUpdatePrompt
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      const onUpdateOriginal = vi.fn();
      const { result } = renderHook(() =>
        usePromptEditor({ ...defaultOptions, onUpdateOriginal })
      );

      act(() => {
        result.current.actions.open();
      });

      await waitFor(() => {
        expect(result.current.form.promptText).not.toBe('');
      });

      // First attempt fails
      await act(async () => {
        await result.current.actions.update();
      });

      expect(result.current.validation.operationError).toBe('First error');

      // Second attempt succeeds
      await act(async () => {
        await result.current.actions.update();
      });

      expect(result.current.validation.operationError).toBeUndefined();
      expect(onUpdateOriginal).toHaveBeenCalled();
    });
  });
});
