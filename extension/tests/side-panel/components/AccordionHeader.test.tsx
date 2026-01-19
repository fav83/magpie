import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccordionHeader } from '../../../src/side-panel/components/AccordionHeader';

describe('AccordionHeader', () => {
  const defaultProps = {
    title: 'Test Video Title',
    promptName: 'Default Summary',
    isExpanded: false,
    onToggle: vi.fn(),
    actionButton: undefined,
    fontSize: 14,
  };

  describe('basic rendering', () => {
    it('should render title', () => {
      render(<AccordionHeader {...defaultProps} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    it('should render prompt name with Prompt prefix', () => {
      render(<AccordionHeader {...defaultProps} />);
      expect(screen.getByText('Prompt: Default Summary')).toBeInTheDocument();
    });

    it('should have title attribute on title element', () => {
      render(<AccordionHeader {...defaultProps} />);
      const titleElement = screen.getByText('Test Video Title');
      expect(titleElement).toHaveAttribute('title', 'Test Video Title');
    });

    it('should have truncate class on title', () => {
      render(<AccordionHeader {...defaultProps} />);
      const titleElement = screen.getByText('Test Video Title');
      expect(titleElement).toHaveClass('truncate');
    });

    it('should have truncate class on prompt name', () => {
      render(<AccordionHeader {...defaultProps} />);
      const promptElement = screen.getByText(/Prompt:/).closest('p');
      expect(promptElement).toHaveClass('truncate');
    });
  });

  describe('collapsed state', () => {
    it('should show Expand label when collapsed', () => {
      render(<AccordionHeader {...defaultProps} isExpanded={false} />);
      expect(screen.getByLabelText('Expand')).toBeInTheDocument();
    });

    it('should not show Collapse label when collapsed', () => {
      render(<AccordionHeader {...defaultProps} isExpanded={false} />);
      expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument();
    });
  });

  describe('expanded state', () => {
    it('should show Collapse label when expanded', () => {
      render(<AccordionHeader {...defaultProps} isExpanded={true} />);
      expect(screen.getByLabelText('Collapse')).toBeInTheDocument();
    });

    it('should not show Expand label when expanded', () => {
      render(<AccordionHeader {...defaultProps} isExpanded={true} />);
      expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument();
    });
  });

  describe('toggle behavior', () => {
    it('should call onToggle when header button is clicked', () => {
      const onToggle = vi.fn();
      render(<AccordionHeader {...defaultProps} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button', { name: /test video title/i }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('action button - delete type', () => {
    it('should render delete button when actionButton type is delete', () => {
      const onDelete = vi.fn();
      render(
        <AccordionHeader
          {...defaultProps}
          actionButton={{ type: 'delete', onClick: onDelete, title: 'Delete summary' }}
        />
      );

      expect(screen.getByLabelText('Delete summary')).toBeInTheDocument();
    });

    it('should call onClick when delete button is clicked', () => {
      const onDelete = vi.fn();
      const onToggle = vi.fn();
      render(
        <AccordionHeader
          {...defaultProps}
          onToggle={onToggle}
          actionButton={{ type: 'delete', onClick: onDelete, title: 'Delete summary' }}
        />
      );

      fireEvent.click(screen.getByLabelText('Delete summary'));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should render delete icon SVG', () => {
      render(
        <AccordionHeader
          {...defaultProps}
          actionButton={{ type: 'delete', onClick: vi.fn(), title: 'Delete' }}
        />
      );

      const actionButton = screen.getByLabelText('Delete');
      const svg = actionButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('action button - cancel type', () => {
    it('should render cancel button when actionButton type is cancel', () => {
      const onCancel = vi.fn();
      render(
        <AccordionHeader
          {...defaultProps}
          actionButton={{ type: 'cancel', onClick: onCancel, title: 'Cancel generation' }}
        />
      );

      expect(screen.getByLabelText('Cancel generation')).toBeInTheDocument();
    });

    it('should call onClick when cancel button is clicked', () => {
      const onCancel = vi.fn();
      const onToggle = vi.fn();
      render(
        <AccordionHeader
          {...defaultProps}
          onToggle={onToggle}
          actionButton={{ type: 'cancel', onClick: onCancel, title: 'Cancel generation' }}
        />
      );

      fireEvent.click(screen.getByLabelText('Cancel generation'));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should render X icon for cancel', () => {
      render(
        <AccordionHeader
          {...defaultProps}
          actionButton={{ type: 'cancel', onClick: vi.fn(), title: 'Cancel' }}
        />
      );

      const actionButton = screen.getByLabelText('Cancel');
      const svg = actionButton.querySelector('svg');
      const path = svg?.querySelector('path');
      expect(path).toHaveAttribute('d', 'M6 18L18 6M6 6l12 12');
    });
  });

  describe('no action button', () => {
    it('should not render action button when actionButton is undefined', () => {
      const { container } = render(<AccordionHeader {...defaultProps} actionButton={undefined} />);

      // Only one button should exist (the toggle button)
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(1);
    });
  });

  describe('styling', () => {
    it('should have proper layout classes', () => {
      const { container } = render(<AccordionHeader {...defaultProps} />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-start', 'gap-1.5', 'px-2', 'py-1.5');
    });

    it('should have text-left alignment on toggle button', () => {
      render(<AccordionHeader {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: /test video title/i });
      expect(toggleButton).toHaveClass('text-left');
    });

    it('should have hover styles on action button', () => {
      render(
        <AccordionHeader
          {...defaultProps}
          actionButton={{ type: 'delete', onClick: vi.fn(), title: 'Delete' }}
        />
      );

      const actionButton = screen.getByLabelText('Delete');
      expect(actionButton).toHaveClass('hover:text-red-500', 'hover:bg-red-50');
    });
  });

  describe('long content handling', () => {
    it('should truncate long video titles', () => {
      const longTitle = 'This is a very long video title that should be truncated when displayed in the UI';
      render(<AccordionHeader {...defaultProps} title={longTitle} />);

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveClass('truncate');
      expect(titleElement).toHaveAttribute('title', longTitle);
    });

    it('should truncate long prompt names', () => {
      const longPromptName = 'This is a very long prompt name that should also be truncated';
      render(<AccordionHeader {...defaultProps} promptName={longPromptName} />);

      const promptElement = screen.getByText(/Prompt:/).closest('p');
      expect(promptElement).toHaveClass('truncate');
    });
  });
});
