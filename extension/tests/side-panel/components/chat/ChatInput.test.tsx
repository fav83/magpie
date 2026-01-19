import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../../../../src/side-panel/components/chat/ChatInput';

describe('ChatInput', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onCancel: vi.fn(),
    isStreaming: false,
    fontSize: 14,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input field', () => {
    it('should render input with placeholder', () => {
      render(<ChatInput {...defaultProps} />);

      expect(screen.getByPlaceholderText('Ask about this video...')).toBeInTheDocument();
    });

    it('should apply provided font size', () => {
      render(<ChatInput {...defaultProps} fontSize={16} />);

      const input = screen.getByPlaceholderText('Ask about this video...') as HTMLInputElement;
      expect(input.style.fontSize).toBe('16px');
    });

    it('should update value when typing', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Hello' } });

      expect(input.value).toBe('Hello');
    });

    it('should be disabled when streaming', () => {
      render(<ChatInput {...defaultProps} isStreaming={true} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      expect(input).toBeDisabled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<ChatInput {...defaultProps} disabled={true} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      expect(input).toBeDisabled();
    });
  });

  describe('send functionality', () => {
    it('should call onSend when Enter is pressed with content', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      fireEvent.change(input, { target: { value: 'My message' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(defaultProps.onSend).toHaveBeenCalledWith('My message');
    });

    it('should clear input after sending', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'My message' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input.value).toBe('');
    });

    it('should not send empty message', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only message', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it('should not send when streaming', () => {
      render(<ChatInput {...defaultProps} isStreaming={true} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      fireEvent.change(input, { target: { value: 'Message' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it('should call onSend when send button is clicked', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      fireEvent.change(input, { target: { value: 'Click send' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(defaultProps.onSend).toHaveBeenCalledWith('Click send');
    });

    it('should disable send button when empty', () => {
      render(<ChatInput {...defaultProps} />);

      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button when has content', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Ask about this video...');
      fireEvent.change(input, { target: { value: 'Message' } });

      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('cancel functionality', () => {
    it('should show Cancel button when streaming', () => {
      render(<ChatInput {...defaultProps} isStreaming={true} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should hide send button when streaming', () => {
      render(<ChatInput {...defaultProps} isStreaming={true} />);

      expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
    });

    it('should call onCancel when Cancel is clicked', () => {
      render(<ChatInput {...defaultProps} isStreaming={true} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });
});
