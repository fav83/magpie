import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeyForm } from '../../../src/options/components/ApiKeyForm';

// Mock chrome.storage.local
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockAddListener = vi.fn();
const mockRemoveListener = vi.fn();

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
      onChanged: {
        addListener: mockAddListener,
        removeListener: mockRemoveListener,
      },
    },
  },
});

describe('ApiKeyForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
    mockAddListener.mockImplementation(() => {});
    mockRemoveListener.mockImplementation(() => {});
  });

  it('should render input field', () => {
    render(<ApiKeyForm />);

    expect(screen.getByPlaceholderText('sk-or-...')).toBeInTheDocument();
  });

  it('should render save button', () => {
    render(<ApiKeyForm />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('should render link to OpenRouter', () => {
    render(<ApiKeyForm />);

    const link = screen.getByRole('link', { name: 'openrouter.ai/keys' });
    expect(link).toHaveAttribute('href', 'https://openrouter.ai/keys');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should load existing API key on mount', async () => {
    mockStorageGet.mockResolvedValue({ openrouterApiKey: 'sk-or-existing' });

    render(<ApiKeyForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('sk-or-...')).toHaveValue(
        'sk-or-existing'
      );
    });
  });

  it('should show error for invalid key format', async () => {
    render(<ApiKeyForm />);

    const input = screen.getByPlaceholderText('sk-or-...');
    fireEvent.change(input, { target: { value: 'invalid-key' } });

    const form = screen.getByRole('button', { name: 'Save' }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        screen.getByText('Invalid key format. Should start with sk-or-')
      ).toBeInTheDocument();
    });
  });

  it('should save valid API key', async () => {
    render(<ApiKeyForm />);

    const input = screen.getByPlaceholderText('sk-or-...');
    fireEvent.change(input, { target: { value: 'sk-or-valid-key' } });

    const form = screen.getByRole('button', { name: 'Save' }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockStorageSet).toHaveBeenCalledWith({
        openrouterApiKey: 'sk-or-valid-key',
      });
    });
  });

  it('should show success message after saving', async () => {
    render(<ApiKeyForm />);

    const input = screen.getByPlaceholderText('sk-or-...');
    fireEvent.change(input, { target: { value: 'sk-or-valid-key' } });

    const form = screen.getByRole('button', { name: 'Save' }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });
  });

  it('should clear error when typing new value', async () => {
    render(<ApiKeyForm />);

    const input = screen.getByPlaceholderText('sk-or-...');

    // First, trigger error
    fireEvent.change(input, { target: { value: 'invalid' } });
    const form = screen.getByRole('button', { name: 'Save' }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        screen.getByText('Invalid key format. Should start with sk-or-')
      ).toBeInTheDocument();
    });

    // Then save valid key - error should clear
    fireEvent.change(input, { target: { value: 'sk-or-new' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        screen.queryByText('Invalid key format. Should start with sk-or-')
      ).not.toBeInTheDocument();
    });
  });
});
