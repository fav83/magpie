import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Error } from '../../../src/side-panel/components/Error';

// Mock useChromeStorage hook
vi.mock('../../../src/hooks/useChromeStorage', () => ({
  useChromeStorage: () => ['sk-or-test-key', vi.fn(), false],
}));

// Mock CompactModelSelector
vi.mock('../../../src/side-panel/components/CompactModelSelector', () => ({
  CompactModelSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button
      data-testid="model-selector"
      onClick={() => onChange('new-model')}
    >
      {value}
    </button>
  ),
}));

describe('Error', () => {
  it('should render error message', () => {
    render(<Error message="Something went wrong" onRetry={() => {}} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render retry button', () => {
    render(<Error message="Error" onRetry={() => {}} />);

    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('should call onRetry when button is clicked', () => {
    const mockRetry = vi.fn();
    render(<Error message="Error" onRetry={mockRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('should render different error messages', () => {
    const { rerender } = render(
      <Error message="Please add your API key" onRetry={() => {}} />
    );

    expect(screen.getByText('Please add your API key')).toBeInTheDocument();

    rerender(<Error message="Rate limited" onRetry={() => {}} />);

    expect(screen.getByText('Rate limited')).toBeInTheDocument();
  });

  describe('model selector', () => {
    it('should not show model selector when props are not provided', () => {
      render(<Error message="Error" onRetry={() => {}} />);

      expect(screen.queryByTestId('model-selector')).not.toBeInTheDocument();
      expect(screen.queryByText('Try a different model:')).not.toBeInTheDocument();
    });

    it('should show model selector when model props are provided', () => {
      render(
        <Error
          message="Error"
          onRetry={() => {}}
          selectedModelId="openai/gpt-4o-mini"
          onModelChange={() => {}}
        />
      );

      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
      expect(screen.getByText('Try a different model:')).toBeInTheDocument();
    });

    it('should call onModelChange when model is changed', () => {
      const mockModelChange = vi.fn();
      render(
        <Error
          message="Error"
          onRetry={() => {}}
          selectedModelId="openai/gpt-4o-mini"
          onModelChange={mockModelChange}
        />
      );

      fireEvent.click(screen.getByTestId('model-selector'));

      expect(mockModelChange).toHaveBeenCalledWith('new-model');
    });

    it('should display current model in selector', () => {
      render(
        <Error
          message="Error"
          onRetry={() => {}}
          selectedModelId="anthropic/claude-3-haiku"
          onModelChange={() => {}}
        />
      );

      expect(screen.getByText('anthropic/claude-3-haiku')).toBeInTheDocument();
    });
  });
});
