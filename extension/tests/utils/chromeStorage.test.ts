import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBooleanStorage, createArrayStorage } from '../../src/utils/chromeStorage';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

const mockGet = vi.fn((keys: string | string[]) => {
  const keysArray = typeof keys === 'string' ? [keys] : keys;
  const result: Record<string, unknown> = {};
  for (const key of keysArray) {
    if (key in mockStorage) {
      result[key] = mockStorage[key];
    }
  }
  return Promise.resolve(result);
});

const mockSet = vi.fn((data: Record<string, unknown>) => {
  Object.assign(mockStorage, data);
  return Promise.resolve();
});

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
    },
  },
});

describe('chromeStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe('createBooleanStorage', () => {
    const storage = createBooleanStorage('testBoolKey');

    describe('get', () => {
      it('should return false when key does not exist', async () => {
        const result = await storage.get();
        expect(result).toBe(false);
      });

      it('should return stored value when key exists', async () => {
        mockStorage.testBoolKey = true;
        const result = await storage.get();
        expect(result).toBe(true);
      });

      it('should return false for stored false value', async () => {
        mockStorage.testBoolKey = false;
        const result = await storage.get();
        expect(result).toBe(false);
      });
    });

    describe('set', () => {
      it('should store true value', async () => {
        await storage.set(true);
        expect(mockSet).toHaveBeenCalledWith({ testBoolKey: true });
        expect(mockStorage.testBoolKey).toBe(true);
      });

      it('should store false value', async () => {
        await storage.set(false);
        expect(mockSet).toHaveBeenCalledWith({ testBoolKey: false });
        expect(mockStorage.testBoolKey).toBe(false);
      });
    });

    describe('toggle', () => {
      it('should toggle from false to true', async () => {
        mockStorage.testBoolKey = false;
        const result = await storage.toggle();
        expect(result).toBe(true);
        expect(mockStorage.testBoolKey).toBe(true);
      });

      it('should toggle from true to false', async () => {
        mockStorage.testBoolKey = true;
        const result = await storage.toggle();
        expect(result).toBe(false);
        expect(mockStorage.testBoolKey).toBe(false);
      });

      it('should toggle from undefined (default false) to true', async () => {
        const result = await storage.toggle();
        expect(result).toBe(true);
        expect(mockStorage.testBoolKey).toBe(true);
      });
    });
  });

  describe('createArrayStorage', () => {
    const storage = createArrayStorage<string>('testArrayKey');

    describe('get', () => {
      it('should return empty array when key does not exist', async () => {
        const result = await storage.get();
        expect(result).toEqual([]);
      });

      it('should return stored array when key exists', async () => {
        mockStorage.testArrayKey = ['a', 'b', 'c'];
        const result = await storage.get();
        expect(result).toEqual(['a', 'b', 'c']);
      });
    });

    describe('set', () => {
      it('should store array value', async () => {
        await storage.set(['x', 'y', 'z']);
        expect(mockSet).toHaveBeenCalledWith({ testArrayKey: ['x', 'y', 'z'] });
        expect(mockStorage.testArrayKey).toEqual(['x', 'y', 'z']);
      });

      it('should store empty array', async () => {
        await storage.set([]);
        expect(mockSet).toHaveBeenCalledWith({ testArrayKey: [] });
        expect(mockStorage.testArrayKey).toEqual([]);
      });
    });

    describe('add', () => {
      it('should add item to empty array', async () => {
        await storage.add('item1');
        expect(mockStorage.testArrayKey).toEqual(['item1']);
      });

      it('should add item to existing array', async () => {
        mockStorage.testArrayKey = ['existing'];
        await storage.add('new');
        expect(mockStorage.testArrayKey).toEqual(['existing', 'new']);
      });

      it('should not add duplicate item', async () => {
        mockStorage.testArrayKey = ['item1', 'item2'];
        await storage.add('item1');
        expect(mockStorage.testArrayKey).toEqual(['item1', 'item2']);
      });
    });

    describe('remove', () => {
      it('should remove existing item', async () => {
        mockStorage.testArrayKey = ['a', 'b', 'c'];
        await storage.remove('b');
        expect(mockStorage.testArrayKey).toEqual(['a', 'c']);
      });

      it('should do nothing when removing non-existent item', async () => {
        mockStorage.testArrayKey = ['a', 'b'];
        await storage.remove('c');
        expect(mockStorage.testArrayKey).toEqual(['a', 'b']);
      });

      it('should handle removing from empty array', async () => {
        await storage.remove('item');
        expect(mockStorage.testArrayKey).toEqual([]);
      });
    });

    describe('toggle', () => {
      it('should add item if not present and return true', async () => {
        mockStorage.testArrayKey = ['a'];
        const result = await storage.toggle('b');
        expect(result).toBe(true);
        expect(mockStorage.testArrayKey).toEqual(['a', 'b']);
      });

      it('should remove item if present and return false', async () => {
        mockStorage.testArrayKey = ['a', 'b'];
        const result = await storage.toggle('b');
        expect(result).toBe(false);
        expect(mockStorage.testArrayKey).toEqual(['a']);
      });

      it('should add to empty array', async () => {
        const result = await storage.toggle('item');
        expect(result).toBe(true);
        expect(mockStorage.testArrayKey).toEqual(['item']);
      });
    });

    describe('has', () => {
      it('should return true when item exists', async () => {
        mockStorage.testArrayKey = ['a', 'b', 'c'];
        const result = await storage.has('b');
        expect(result).toBe(true);
      });

      it('should return false when item does not exist', async () => {
        mockStorage.testArrayKey = ['a', 'b', 'c'];
        const result = await storage.has('d');
        expect(result).toBe(false);
      });

      it('should return false for empty array', async () => {
        const result = await storage.has('anything');
        expect(result).toBe(false);
      });
    });
  });

  describe('typed array storage', () => {
    it('should work with number arrays', async () => {
      const numberStorage = createArrayStorage<number>('numberKey');
      await numberStorage.set([1, 2, 3]);
      expect(mockStorage.numberKey).toEqual([1, 2, 3]);

      await numberStorage.add(4);
      expect(mockStorage.numberKey).toEqual([1, 2, 3, 4]);

      const hasThree = await numberStorage.has(3);
      expect(hasThree).toBe(true);
    });

    it('should work with object arrays', async () => {
      interface Item {
        id: string;
        value: number;
      }
      const objectStorage = createArrayStorage<Item>('objectKey');

      const item1: Item = { id: 'a', value: 1 };
      const item2: Item = { id: 'b', value: 2 };

      await objectStorage.set([item1, item2]);
      expect(mockStorage.objectKey).toEqual([item1, item2]);

      const items = await objectStorage.get();
      expect(items).toHaveLength(2);
      expect(items[0]?.id).toBe('a');
    });
  });
});
