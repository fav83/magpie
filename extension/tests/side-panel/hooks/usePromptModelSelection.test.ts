import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromptModelSelection } from '../../../src/side-panel/hooks/usePromptModelSelection';

describe('usePromptModelSelection', () => {
  it('should initialize with provided values', () => {
    const { result } = renderHook(() =>
      usePromptModelSelection({
        initialPromptId: 'prompt-1',
        initialModelId: 'model-1',
      })
    );

    expect(result.current.selectedPromptId).toBe('prompt-1');
    expect(result.current.selectedModelId).toBe('model-1');
  });

  it('should update prompt and model when handlePromptChange is called', () => {
    const { result } = renderHook(() =>
      usePromptModelSelection({
        initialPromptId: 'prompt-1',
        initialModelId: 'model-1',
      })
    );

    act(() => {
      result.current.handlePromptChange('prompt-2', 'model-2');
    });

    expect(result.current.selectedPromptId).toBe('prompt-2');
    expect(result.current.selectedModelId).toBe('model-2');
  });

  it('should only update model when handleModelChange is called', () => {
    const { result } = renderHook(() =>
      usePromptModelSelection({
        initialPromptId: 'prompt-1',
        initialModelId: 'model-1',
      })
    );

    act(() => {
      result.current.handleModelChange('model-2');
    });

    expect(result.current.selectedPromptId).toBe('prompt-1');
    expect(result.current.selectedModelId).toBe('model-2');
  });

  describe('hasChanges', () => {
    it('should return false when nothing has changed', () => {
      const { result } = renderHook(() =>
        usePromptModelSelection({
          initialPromptId: 'prompt-1',
          initialModelId: 'model-1',
        })
      );

      expect(result.current.hasChanges('prompt-1', 'model-1')).toBe(false);
    });

    it('should return true when prompt has changed', () => {
      const { result } = renderHook(() =>
        usePromptModelSelection({
          initialPromptId: 'prompt-1',
          initialModelId: 'model-1',
        })
      );

      act(() => {
        result.current.handlePromptChange('prompt-2', 'model-1');
      });

      expect(result.current.hasChanges('prompt-1', 'model-1')).toBe(true);
    });

    it('should return true when model has changed', () => {
      const { result } = renderHook(() =>
        usePromptModelSelection({
          initialPromptId: 'prompt-1',
          initialModelId: 'model-1',
        })
      );

      act(() => {
        result.current.handleModelChange('model-2');
      });

      expect(result.current.hasChanges('prompt-1', 'model-1')).toBe(true);
    });

    it('should return true when both have changed', () => {
      const { result } = renderHook(() =>
        usePromptModelSelection({
          initialPromptId: 'prompt-1',
          initialModelId: 'model-1',
        })
      );

      act(() => {
        result.current.handlePromptChange('prompt-2', 'model-2');
      });

      expect(result.current.hasChanges('prompt-1', 'model-1')).toBe(true);
    });

    it('should compare against provided original values, not initial', () => {
      const { result } = renderHook(() =>
        usePromptModelSelection({
          initialPromptId: 'prompt-1',
          initialModelId: 'model-1',
        })
      );

      // Change to new values
      act(() => {
        result.current.handlePromptChange('prompt-2', 'model-2');
      });

      // Compare against the current values - should be false
      expect(result.current.hasChanges('prompt-2', 'model-2')).toBe(false);
    });
  });
});
