/**
 * Generic Chrome storage utilities to reduce boilerplate
 */

/**
 * Create a boolean storage helper for toggle-style preferences
 */
export function createBooleanStorage(storageKey: string) {
  return {
    async get(): Promise<boolean> {
      const result = await chrome.storage.local.get(storageKey);
      return (result[storageKey] as boolean | undefined) ?? false;
    },

    async set(value: boolean): Promise<void> {
      await chrome.storage.local.set({ [storageKey]: value });
    },

    async toggle(): Promise<boolean> {
      const current = await this.get();
      const newValue = !current;
      await this.set(newValue);
      return newValue;
    },
  };
}

/**
 * Create an array storage helper for list-style preferences (e.g., preferred model IDs)
 */
export function createArrayStorage<T>(storageKey: string) {
  return {
    async get(): Promise<T[]> {
      const result = await chrome.storage.local.get(storageKey);
      return (result[storageKey] as T[] | undefined) ?? [];
    },

    async set(value: T[]): Promise<void> {
      await chrome.storage.local.set({ [storageKey]: value });
    },

    async add(item: T): Promise<void> {
      const current = await this.get();
      if (!current.includes(item)) {
        await this.set([...current, item]);
      }
    },

    async remove(item: T): Promise<void> {
      const current = await this.get();
      await this.set(current.filter((i) => i !== item));
    },

    async toggle(item: T): Promise<boolean> {
      const current = await this.get();
      const exists = current.includes(item);
      const updated = exists
        ? current.filter((i) => i !== item)
        : [...current, item];
      await this.set(updated);
      return !exists;
    },

    async has(item: T): Promise<boolean> {
      const current = await this.get();
      return current.includes(item);
    },
  };
}
