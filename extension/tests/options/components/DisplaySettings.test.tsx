import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DisplaySettings } from '../../../src/options/components/DisplaySettings';

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

describe('DisplaySettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
    mockAddListener.mockImplementation(() => {});
    mockRemoveListener.mockImplementation(() => {});
  });

  it('should render section header', () => {
    render(<DisplaySettings />);

    expect(screen.getByText('Display Settings')).toBeInTheDocument();
  });

  it('should render font size label', () => {
    render(<DisplaySettings />);

    expect(screen.getByText('Summary Font Size')).toBeInTheDocument();
  });

  it('should render slider with min and max labels', () => {
    render(<DisplaySettings />);

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('min', '6');
    expect(slider).toHaveAttribute('max', '24');

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('should render help text', () => {
    render(<DisplaySettings />);

    expect(
      screen.getByText('Controls the font size of summary text in the sidebar.')
    ).toBeInTheDocument();
  });

  it('should default to 12 when no stored value', () => {
    render(<DisplaySettings />);

    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('12');
    expect(screen.getByText('12px')).toBeInTheDocument();
  });

  it('should load stored font size on mount', async () => {
    mockStorageGet.mockResolvedValue({ summaryFontSize: 16 });

    render(<DisplaySettings />);

    await waitFor(() => {
      const slider = screen.getByRole('slider') as HTMLInputElement;
      expect(slider.value).toBe('16');
      expect(screen.getByText('16px')).toBeInTheDocument();
    });
  });

  it('should save font size when changed', async () => {
    render(<DisplaySettings />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '14' } });

    await waitFor(() => {
      expect(mockStorageSet).toHaveBeenCalledWith({
        summaryFontSize: 14,
      });
    });
  });

  it('should update displayed value when slider changes', async () => {
    render(<DisplaySettings />);

    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '18' } });

    await waitFor(() => {
      expect(slider.value).toBe('18');
      expect(screen.getByText('18px')).toBeInTheDocument();
    });
  });

  it('should call storage listener setup on mount', () => {
    render(<DisplaySettings />);

    expect(mockAddListener).toHaveBeenCalled();
  });

  it('should remove storage listener on unmount', () => {
    const { unmount } = render(<DisplaySettings />);

    unmount();

    expect(mockRemoveListener).toHaveBeenCalled();
  });
});
