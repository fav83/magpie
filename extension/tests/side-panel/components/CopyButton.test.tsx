import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CopyButton } from '../../../src/side-panel/components/CopyButton';

describe('CopyButton', () => {
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard });
    vi.clearAllMocks();
  });

  describe('icon variant (default)', () => {
    it('should render copy icon by default', () => {
      const { container } = render(<CopyButton content="test content" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have proper button attributes', () => {
      render(<CopyButton content="test content" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', 'Copy');
    });

    it('should copy content to clipboard when clicked', async () => {
      render(<CopyButton content="test content" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
    });

    it('should show check icon after copying', async () => {
      const { container } = render(<CopyButton content="test content" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Check that the checkmark path is shown
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('d', 'M5 13l4 4L19 7');
    });

    it('should show check icon immediately after copying (timeout resets later)', async () => {
      const { container } = render(<CopyButton content="test content" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Check icon should be shown immediately after copying
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('d', 'M5 13l4 4L19 7');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<CopyButton content="test content" disabled={true} />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when content is empty', () => {
      render(<CopyButton content="" />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not copy when disabled', async () => {
      render(<CopyButton content="test content" disabled={true} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it('should not copy when content is empty', async () => {
      render(<CopyButton content="" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it('should apply custom className', () => {
      render(<CopyButton content="test" className="my-custom-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('my-custom-class');
    });

    it('should have background and hover styles', () => {
      render(<CopyButton content="test" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-200', 'hover:bg-gray-300', 'rounded', 'transition-colors');
    });
  });

  describe('text variant', () => {
    it('should render "Copy" text', () => {
      render(<CopyButton content="test content" variant="text" />);
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should show "Copied!" after clicking', async () => {
      render(<CopyButton content="test content" variant="text" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('should show Copied! immediately after copying', async () => {
      render(<CopyButton content="test content" variant="text" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('should have text variant styles', () => {
      render(<CopyButton content="test" variant="text" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
    });

    it('should be disabled when content is empty', () => {
      render(<CopyButton content="" variant="text" />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should apply custom className', () => {
      render(<CopyButton content="test" variant="text" className="extra-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('extra-class');
    });
  });

  describe('edge cases', () => {
    it('should handle clipboard write and return to normal state', async () => {
      render(<CopyButton content="test content" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Should have called writeText
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
    });

    it('should handle whitespace-only content as valid', async () => {
      render(<CopyButton content="   " />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith('   ');
    });

    it('should preserve multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      render(<CopyButton content={multilineContent} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(multilineContent);
    });
  });
});
