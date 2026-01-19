import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptActions } from '../../../src/options/components/PromptActions';

describe('PromptActions', () => {
  const defaultProps = {
    isNew: false,
    isSystem: false,
    isDefault: false,
    canSave: true,
    isSaving: false,
    onSave: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onSetDefault: vi.fn(),
    onCancel: vi.fn(),
  };

  describe('new prompt mode', () => {
    it('should show Create and Cancel buttons for new prompts', () => {
      render(<PromptActions {...defaultProps} isNew={true} />);

      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should disable Create button when canSave is false', () => {
      render(<PromptActions {...defaultProps} isNew={true} canSave={false} />);

      expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    });

    it('should show Creating... when isSaving is true', () => {
      render(<PromptActions {...defaultProps} isNew={true} isSaving={true} />);

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument();
    });

    it('should call onSave when Create is clicked', () => {
      render(<PromptActions {...defaultProps} isNew={true} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('should call onCancel when Cancel is clicked', () => {
      render(<PromptActions {...defaultProps} isNew={true} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('existing prompt mode', () => {
    it('should show Save, Duplicate, Delete, and Set as Default buttons', () => {
      render(<PromptActions {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Set as Default' })).toBeInTheDocument();
    });

    it('should disable Save button when canSave is false', () => {
      render(<PromptActions {...defaultProps} canSave={false} />);

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should show Saving... when isSaving is true', () => {
      render(<PromptActions {...defaultProps} isSaving={true} />);

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    });

    it('should disable Save button for system prompts', () => {
      render(<PromptActions {...defaultProps} isSystem={true} />);

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should hide Delete button for system prompts', () => {
      render(<PromptActions {...defaultProps} isSystem={true} />);

      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('should hide Set as Default button when prompt is already default', () => {
      render(<PromptActions {...defaultProps} isDefault={true} />);

      expect(screen.queryByRole('button', { name: 'Set as Default' })).not.toBeInTheDocument();
    });

    it('should call onSave when Save is clicked', () => {
      render(<PromptActions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('should call onDuplicate when Duplicate is clicked', () => {
      render(<PromptActions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(defaultProps.onDuplicate).toHaveBeenCalled();
    });

    it('should call onDelete when Delete is clicked', () => {
      render(<PromptActions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(defaultProps.onDelete).toHaveBeenCalled();
    });

    it('should call onSetDefault when Set as Default is clicked', () => {
      render(<PromptActions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Set as Default' }));

      expect(defaultProps.onSetDefault).toHaveBeenCalled();
    });
  });
});
