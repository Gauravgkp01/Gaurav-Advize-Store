const store = new Map<string, { data: unknown; expiresAt: number }>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = 30_000): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheDeleteByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
