/**
 * Simple in-memory cache for API responses
 * In production, this should be replaced with Redis
 */

interface CacheEntry {
  data: any;
  expiry: number;
}

class Cache {
  private store: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  set(key: string, value: any, ttlSeconds: number = 60): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { data: value, expiry });
  }

  get(key: string): any | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

export const cache = new Cache();

/**
 * Cache middleware for Express routes
 */
export function cacheMiddleware(ttlSeconds: number = 60) {
  return (req: any, res: any, next: any) => {
    const cacheKey = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      cache.set(cacheKey, data, ttlSeconds);
      return originalJson(data);
    };

    next();
  };
}
