import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptEditor } from '../../../src/side-panel/components/PromptEditor';

describe('PromptEditor', () => {
  const defaultHandlers = {
    onPromptTextChange: vi.fn(),
    onNewPromptNameChange: vi.fn(),
    onApply: vi.fn(),
    onUpdate: vi.fn(),
    onSaveNew: vi.fn(),
    onConfirmSaveNew: vi.fn(),
    onBackFromSaveNew: vi.fn(),
    onCancel: vi.fn(),
  };

  const defaultProps = {
    mode: 'editing' as const,
    promptText: 'Test prompt with {transcript}',
    newPromptName: '',
    isValid: true,
    validationError: undefined,
    operationError: undefined,
    isSystemPrompt: false,
    isLoading: false,
    ...defaultHandlers,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('closed mode', () => {
    it('should render nothing when mode is closed', () => {
      const { container } = render(<PromptEditor {...defaultProps} mode="closed" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<PromptEditor {...defaultProps} isLoading={true} />);
      expect(screen.getByText('Loading prompt...')).toBeInTheDocument();
    });

    it('should not show textarea when loading', () => {
      render(<PromptEditor {...defaultProps} isLoading={true} />);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('editing mode', () => {
    it('should render textarea with prompt text', () => {
      render(<PromptEditor {...defaultProps} />);
      expect(screen.getByRole('textbox')).toHaveValue('Test prompt with {transcript}');
    });

    it('should call onPromptTextChange when textarea value changes', () => {
      render(<PromptEditor {...defaultProps} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New text' } });
      expect(defaultHandlers.onPromptTextChange).toHaveBeenCalledWith('New text');
    });

    it('should show all action buttons in editing mode', () => {
      render(<PromptEditor {...defaultProps} />);
      expect(screen.getByText('Apply')).toBeInTheDocument();
      expect(screen.getByText('Update')).toBeInTheDocument();
      expect(screen.getByText('Save new')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onApply when Apply button is clicked', () => {
      render(<PromptEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Apply'));
      expect(defaultHandlers.onApply).toHaveBeenCalled();
    });

    it('should call onUpdate when Update button is clicked', () => {
      render(<PromptEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Update'));
      expect(defaultHandlers.onUpdate).toHaveBeenCalled();
    });

    it('should call onSaveNew when Save new button is clicked', () => {
      render(<PromptEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Save new'));
      expect(defaultHandlers.onSaveNew).toHaveBeenCalled();
    });

    it('should call onCancel when Cancel button is clicked', () => {
      render(<PromptEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultHandlers.onCancel).toHaveBeenCalled();
    });

    it('should disable Apply button when not valid', () => {
      render(<PromptEditor {...defaultProps} isValid={false} />);
      expect(screen.getByText('Apply')).toBeDisabled();
    });

    it('should disable Update button for system prompts', () => {
      render(<PromptEditor {...defaultProps} isSystemPrompt={true} />);
      expect(screen.getByText('Update')).toBeDisabled();
    });

    it('should have title on Update button for system prompts', () => {
      render(<PromptEditor {...defaultProps} isSystemPrompt={true} />);
      expect(screen.getByText('Update')).toHaveAttribute('title', 'System prompts cannot be modified');
    });

    it('should not show name input in editing mode', () => {
      render(<PromptEditor {...defaultProps} />);
      expect(screen.queryByLabelText(/new prompt name/i)).not.toBeInTheDocument();
    });
  });

  describe('saving-new mode', () => {
    const savingNewProps = {
      ...defaultProps,
      mode: 'saving-new' as const,
      newPromptName: 'Copy of Default',
    };

    it('should show name input in saving-new mode', () => {
      render(<PromptEditor {...savingNewProps} />);
      expect(screen.getByPlaceholderText('Enter prompt name...')).toBeInTheDocument();
    });

    it('should show Confirm and Back buttons', () => {
      render(<PromptEditor {...savingNewProps} />);
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('should not show Apply, Update, Save new, Cancel buttons', () => {
      render(<PromptEditor {...savingNewProps} />);
      expect(screen.queryByText('Apply')).not.toBeInTheDocument();
      expect(screen.queryByText('Update')).not.toBeInTheDocument();
      expect(screen.queryByText('Save new')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('should call onNewPromptNameChange when name input changes', () => {
      render(<PromptEditor {...savingNewProps} />);
      fireEvent.change(screen.getByPlaceholderText('Enter prompt name...'), { target: { value: 'New Name' } });
      expect(defaultHandlers.onNewPromptNameChange).toHaveBeenCalledWith('New Name');
    });

    it('should call onConfirmSaveNew when Confirm is clicked', () => {
      render(<PromptEditor {...savingNewProps} />);
      fireEvent.click(screen.getByText('Confirm'));
      expect(defaultHandlers.onConfirmSaveNew).toHaveBeenCalled();
    });

    it('should call onBackFromSaveNew when Back is clicked', () => {
      render(<PromptEditor {...savingNewProps} />);
      fireEvent.click(screen.getByText('Back'));
      expect(defaultHandlers.onBackFromSaveNew).toHaveBeenCalled();
    });

    it('should disable Confirm when name is empty', () => {
      render(<PromptEditor {...savingNewProps} newPromptName="" />);
      expect(screen.getByText('Confirm')).toBeDisabled();
    });

    it('should disable Confirm when name is whitespace only', () => {
      render(<PromptEditor {...savingNewProps} newPromptName="   " />);
      expect(screen.getByText('Confirm')).toBeDisabled();
    });

    it('should enable Confirm when name is valid', () => {
      render(<PromptEditor {...savingNewProps} newPromptName="Valid Name" />);
      expect(screen.getByText('Confirm')).not.toBeDisabled();
    });
  });

  describe('validation error display', () => {
    it('should show validation error when present', () => {
      render(<PromptEditor {...defaultProps} validationError="Prompt must include {transcript}" />);
      expect(screen.getByText('Prompt must include {transcript}')).toBeInTheDocument();
    });

    it('should not show validation error when undefined', () => {
      render(<PromptEditor {...defaultProps} validationError={undefined} />);
      expect(screen.queryByText(/must include/)).not.toBeInTheDocument();
    });

    it('should show warning icon with error', () => {
      render(<PromptEditor {...defaultProps} validationError="Error message" />);
      expect(screen.getByText('⚠')).toBeInTheDocument();
    });
  });

  describe('operation error display', () => {
    it('should show operation error when present', () => {
      render(<PromptEditor {...defaultProps} operationError="Failed to save prompt" />);
      expect(screen.getByText('Failed to save prompt')).toBeInTheDocument();
    });

    it('should not show operation error when undefined', () => {
      render(<PromptEditor {...defaultProps} operationError={undefined} />);
      expect(screen.queryByText(/Failed to/)).not.toBeInTheDocument();
    });

    it('should show both validation and operation errors', () => {
      render(
        <PromptEditor
          {...defaultProps}
          validationError="Validation error"
          operationError="Operation error"
        />
      );
      expect(screen.getByText('Validation error')).toBeInTheDocument();
      expect(screen.getByText('Operation error')).toBeInTheDocument();
    });
  });
});
