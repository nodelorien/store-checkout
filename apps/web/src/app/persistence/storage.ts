export const STORAGE_KEY = 'checkout:v1';

/**
 * `localStorage` can throw on access (privacy modes), on write (quota) and return garbage.
 * Persistence is a convenience: every failure degrades to "nothing persisted".
 */
export function load(): unknown {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function save(value: unknown): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clear(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
