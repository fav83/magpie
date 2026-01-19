import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelList } from '../../../src/components/model-selector/ModelList';
import type { ModelOption } from '../../../src/types/models';

const mockModels: ModelOption[] = [
  { id: 'model-1', name: 'Model 1', pricingDisplay: '$1/1M', isFree: false, contextLength: 4096 },
  { id: 'model-2', name: 'Model 2', pricingDisplay: 'Free', isFree: true, contextLength: 4096 },
  { id: 'model-3', name: 'Model 3', pricingDisplay: '$2/1M', isFree: false, contextLength: 4096 },
];

const defaultProps = {
  models: mockModels,
  filteredModels: mockModels,
  preferredModels: [],
  nonPreferredModels: mockModels,
  unavailablePreferred: [],
  preferredIds: new Set<string>(),
  selectedValue: '',
  search: '',
  showFreeOnly: false,
  onSelect: vi.fn(),
  onTogglePreferred: vi.fn(),
};

describe('ModelList', () => {
  describe('empty states', () => {
    it('should show "No models available" when models array is empty', () => {
      render(
        <ModelList
          {...defaultProps}
          models={[]}
          nonPreferredModels={[]}
        />
      );

      expect(screen.getByText('No models available')).toBeInTheDocument();
    });

    it('should show "No models found" when searching with no results', () => {
      render(
        <ModelList
          {...defaultProps}
          search="nonexistent"
          filteredModels={[]}
        />
      );

      expect(screen.getByText('No models found')).toBeInTheDocument();
    });

    it('should show "No free models match your search" when searching free only with no results', () => {
      render(
        <ModelList
          {...defaultProps}
          search="nonexistent"
          filteredModels={[]}
          showFreeOnly={true}
        />
      );

      expect(screen.getByText('No free models match your search')).toBeInTheDocument();
    });

    it('should show "No free models available" when all filtered out by free filter', () => {
      render(
        <ModelList
          {...defaultProps}
          preferredModels={[]}
          nonPreferredModels={[]}
          unavailablePreferred={[]}
          showFreeOnly={true}
        />
      );

      expect(screen.getByText('No free models available')).toBeInTheDocument();
    });
  });

  describe('model rendering', () => {
    it('should render non-preferred models', () => {
      render(<ModelList {...defaultProps} />);

      expect(screen.getByText('Model 1')).toBeInTheDocument();
      expect(screen.getByText('Model 2')).toBeInTheDocument();
      expect(screen.getByText('Model 3')).toBeInTheDocument();
    });

    it('should render preferred models first', () => {
      const preferred = [mockModels[0]!];
      const nonPreferred = [mockModels[1]!, mockModels[2]!];

      render(
        <ModelList
          {...defaultProps}
          preferredModels={preferred}
          nonPreferredModels={nonPreferred}
          preferredIds={new Set(['model-1'])}
        />
      );

      const items = screen.getAllByRole('button');
      expect(items[0]).toHaveTextContent('Model 1');
    });

    it('should render unavailable preferred models', () => {
      render(
        <ModelList
          {...defaultProps}
          unavailablePreferred={['old/model']}
        />
      );

      expect(screen.getByText('model')).toBeInTheDocument();
      expect(screen.getByText('(unavailable)')).toBeInTheDocument();
    });

    it('should render divider between preferred and non-preferred sections', () => {
      render(
        <ModelList
          {...defaultProps}
          preferredModels={[mockModels[0]!]}
          nonPreferredModels={[mockModels[1]!]}
          preferredIds={new Set(['model-1'])}
        />
      );

      const divider = document.querySelector('.border-t');
      expect(divider).toBeInTheDocument();
    });
  });

  describe('search results', () => {
    it('should render filtered models when searching', () => {
      const filtered = [mockModels[0]!];

      render(
        <ModelList
          {...defaultProps}
          search="Model 1"
          filteredModels={filtered}
        />
      );

      expect(screen.getByText('Model 1')).toBeInTheDocument();
      expect(screen.queryByText('Model 2')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onSelect when model is clicked', () => {
      const onSelect = vi.fn();
      render(<ModelList {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Model 1'));
      expect(onSelect).toHaveBeenCalledWith('model-1');
    });

    it('should call onTogglePreferred when star is clicked', () => {
      const onTogglePreferred = vi.fn();
      render(<ModelList {...defaultProps} onTogglePreferred={onTogglePreferred} />);

      // Star buttons have title "Add to favorites" or "Remove from favorites"
      const starButtons = screen.getAllByTitle(/favorites/i);
      fireEvent.click(starButtons[0]!);
      expect(onTogglePreferred).toHaveBeenCalledWith('model-1');
    });

    it('should highlight selected model', () => {
      render(<ModelList {...defaultProps} selectedValue="model-1" />);

      const modelRow = screen.getByText('Model 1').closest('[role="button"]');
      expect(modelRow).toHaveClass('bg-blue-100');
    });
  });

  describe('size variants', () => {
    it('should render with default size', () => {
      render(<ModelList {...defaultProps} search="x" filteredModels={[]} />);

      const emptyMessage = screen.getByText('No models found');
      expect(emptyMessage).toHaveClass('text-sm');
    });

    it('should render with compact size', () => {
      render(<ModelList {...defaultProps} search="x" filteredModels={[]} size="compact" />);

      const emptyMessage = screen.getByText('No models found');
      expect(emptyMessage).toHaveClass('text-xs');
    });
  });

  describe('free badge', () => {
    it('should show FREE badge for free models', () => {
      render(<ModelList {...defaultProps} />);

      expect(screen.getByText('FREE')).toBeInTheDocument();
    });
  });
});
