import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatHeader } from '../../../../src/side-panel/components/chat/ChatHeader';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('ChatHeader', () => {
  const defaultProps = {
    onClear: vi.fn(),
    onCopyAll: vi.fn(() => 'Copied content'),
    hasMessages: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header display', () => {
    it('should display Chat label', () => {
      render(<ChatHeader {...defaultProps} />);

      expect(screen.getByText('Chat')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('should show copy button when hasMessages is true', () => {
      render(<ChatHeader {...defaultProps} />);

      expect(screen.getByLabelText('Copy chat')).toBeInTheDocument();
    });

    it('should hide copy button when hasMessages is false', () => {
      render(<ChatHeader {...defaultProps} hasMessages={false} />);

      expect(screen.queryByLabelText('Copy chat')).not.toBeInTheDocument();
    });

    it('should call onCopyAll and copy to clipboard when clicked', async () => {
      render(<ChatHeader {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Copy chat'));

      await waitFor(() => {
        expect(defaultProps.onCopyAll).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copied content');
      });
    });

    it('should not copy if onCopyAll returns empty string', async () => {
      const props = { ...defaultProps, onCopyAll: vi.fn(() => '') };
      render(<ChatHeader {...props} />);

      fireEvent.click(screen.getByLabelText('Copy chat'));

      await waitFor(() => {
        expect(props.onCopyAll).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      });
    });
  });

  describe('clear functionality', () => {
    it('should show clear button when onClear is provided and hasMessages', () => {
      render(<ChatHeader {...defaultProps} />);

      expect(screen.getByLabelText('Clear chat')).toBeInTheDocument();
    });

    it('should hide clear button when hasMessages is false', () => {
      render(<ChatHeader {...defaultProps} hasMessages={false} />);

      expect(screen.queryByLabelText('Clear chat')).not.toBeInTheDocument();
    });

    it('should hide clear button when onClear is undefined (readonly mode)', () => {
      const { onClear: _, ...propsWithoutOnClear } = defaultProps;
      render(<ChatHeader {...propsWithoutOnClear} />);

      expect(screen.queryByLabelText('Clear chat')).not.toBeInTheDocument();
    });

    it('should call onClear when clicked', () => {
      render(<ChatHeader {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Clear chat'));

      expect(defaultProps.onClear).toHaveBeenCalled();
    });
  });
});
