interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get cached data if it exists and has not expired.
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in the cache with a specific TTL (time to live) in milliseconds.
   */
  public set<T>(key: string, data: T, ttlMs: number = 600000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  /**
   * Clears all cache entries.
   */
  public clear(): void {
    this.cache.clear();
  }
}

export const apiCache = new MemoryCache();
