import { vi } from 'vitest';

// Node 25+ ships its own global `localStorage` (undefined without --localstorage-file),
// which shadows jsdom's. Tests that need localStorage install this in-memory one.
export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key); },
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  };
}

export function installMemoryLocalStorage(): Storage {
  const storage = createMemoryStorage();
  vi.stubGlobal('localStorage', storage);
  return storage;
}
