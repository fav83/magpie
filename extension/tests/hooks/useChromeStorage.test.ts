import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChromeStorage, useStorageListener } from '../../src/hooks/useChromeStorage';
import { chromeMock, setupChromeMock, resetChromeMock } from '../mocks/chrome';

setupChromeMock();

describe('useChromeStorage', () => {
  beforeEach(() => {
    resetChromeMock();
  });

  it('should return default value initially', () => {
    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('should load stored value', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ testKey: 'stored-value' });

    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    await waitFor(() => {
      expect(result.current[0]).toBe('stored-value');
    });
  });

  it('should update value in storage', async () => {
    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    await act(async () => {
      await result.current[1]('new-value');
    });

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ testKey: 'new-value' });
    expect(result.current[0]).toBe('new-value');
  });

  it('should register storage change listener', () => {
    renderHook(() => useChromeStorage('testKey', 'default'));

    expect(chromeMock.storage.local.onChanged.addListener).toHaveBeenCalled();
  });

  it('should unregister listener on unmount', () => {
    const { unmount } = renderHook(() => useChromeStorage('testKey', 'default'));

    unmount();

    expect(chromeMock.storage.local.onChanged.removeListener).toHaveBeenCalled();
  });

  it('should update value when storage changes', async () => {
    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    // Get the registered listener
    const listener = chromeMock.storage.local.onChanged.addListener.mock.calls[0]![0] as (
      changes: Record<string, { newValue: unknown }>
    ) => void;

    await act(async () => {
      listener({ testKey: { newValue: 'external-change' } });
    });

    expect(result.current[0]).toBe('external-change');
  });

  it('should return loading state', async () => {
    chromeMock.storage.local.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    expect(result.current[2]).toBe(true); // isLoading
  });

  it('should set loading to false after load', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ testKey: 'value' });

    const { result } = renderHook(() => useChromeStorage('testKey', 'default'));

    await waitFor(() => {
      expect(result.current[2]).toBe(false);
    });
  });
});

describe('useStorageListener', () => {
  beforeEach(() => {
    resetChromeMock();
  });

  it('should register listener on mount', () => {
    const callback = vi.fn();
    renderHook(() => useStorageListener(['key1', 'key2'], callback));

    expect(chromeMock.storage.local.onChanged.addListener).toHaveBeenCalled();
  });

  it('should unregister listener on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useStorageListener(['key1'], callback));

    unmount();

    expect(chromeMock.storage.local.onChanged.removeListener).toHaveBeenCalled();
  });

  it('should call callback when watched key changes', () => {
    const callback = vi.fn();
    renderHook(() => useStorageListener(['key1', 'key2'], callback));

    const listener = chromeMock.storage.local.onChanged.addListener.mock.calls[0]![0] as (
      changes: Record<string, unknown>
    ) => void;

    listener({ key1: { newValue: 'test' } });

    expect(callback).toHaveBeenCalled();
  });

  it('should not call callback for unwatched keys', () => {
    const callback = vi.fn();
    renderHook(() => useStorageListener(['key1', 'key2'], callback));

    const listener = chromeMock.storage.local.onChanged.addListener.mock.calls[0]![0] as (
      changes: Record<string, unknown>
    ) => void;

    listener({ otherKey: { newValue: 'test' } });

    expect(callback).not.toHaveBeenCalled();
  });
});
