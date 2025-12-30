/**
 * FuncLib v4 - Cache Layer
 * 
 * LLM yanıtları ve diğer pahalı işlemler için cache.
 * Memory cache, disk persist, TTL desteği.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

// ========================
// Cache Types
// ========================

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
  size: number;
}

interface CacheConfig {
  enabled: boolean;
  ttl: number;           // seconds
  maxSize: number;       // MB
  persistPath: string;
  namespace: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;          // bytes
  entries: number;
  hitRate: number;
}

// ========================
// Cache Class
// ========================

class Cache<T = any> {
  private config: CacheConfig;
  private memory: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    entries: 0,
    hitRate: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      ttl: config.ttl ?? 3600,              // 1 hour
      maxSize: config.maxSize ?? 100,        // 100 MB
      persistPath: config.persistPath ?? '.funclib/cache',
      namespace: config.namespace ?? 'default',
    };

    // Load persisted cache
    this.loadFromDisk();

    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate cache key from input
   */
  private generateKey(input: string | object): string {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return createHash('sha256').update(str).digest('hex').substring(0, 32);
  }

  /**
   * Calculate entry size in bytes
   */
  private calculateSize(value: T): number {
    const str = JSON.stringify(value);
    return Buffer.byteLength(str, 'utf-8');
  }

  /**
   * Get item from cache
   */
  get(key: string | object): T | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const cacheKey = this.generateKey(key);
    const entry = this.memory.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(cacheKey);
      this.stats.size -= entry.size;
      this.stats.entries--;
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Update hit count
    entry.hits++;
    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set item in cache
   */
  set(key: string | object, value: T, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.generateKey(key);
    const size = this.calculateSize(value);
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;

    // Evict if necessary
    while (this.stats.size + size > maxSizeBytes && this.memory.size > 0) {
      this.evictLRU();
    }

    // Remove old entry if exists
    const oldEntry = this.memory.get(cacheKey);
    if (oldEntry) {
      this.stats.size -= oldEntry.size;
      this.stats.entries--;
    }

    const entry: CacheEntry<T> = {
      key: cacheKey,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ((ttl ?? this.config.ttl) * 1000),
      hits: 0,
      size,
    };

    this.memory.set(cacheKey, entry);
    this.stats.size += size;
    this.stats.entries++;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string | object): boolean {
    const cacheKey = this.generateKey(key);
    const entry = this.memory.get(cacheKey);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.memory.delete(cacheKey);
      this.stats.size -= entry.size;
      this.stats.entries--;
      return false;
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key: string | object): boolean {
    const cacheKey = this.generateKey(key);
    const entry = this.memory.get(cacheKey);

    if (entry) {
      this.memory.delete(cacheKey);
      this.stats.size -= entry.size;
      this.stats.entries--;
      return true;
    }

    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memory.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
      hitRate: 0,
    };
  }

  /**
   * Get or set with factory function
   */
  async getOrSet(key: string | object, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTime = Infinity;

    for (const [key, entry] of this.memory) {
      // Prioritize by hits, then by creation time
      if (entry.hits < lruHits || (entry.hits === lruHits && entry.createdAt < lruTime)) {
        lruKey = key;
        lruHits = entry.hits;
        lruTime = entry.createdAt;
      }
    }

    if (lruKey) {
      const entry = this.memory.get(lruKey)!;
      this.memory.delete(lruKey);
      this.stats.size -= entry.size;
      this.stats.entries--;
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.memory) {
      if (now > entry.expiresAt) {
        toDelete.push(key);
        this.stats.size -= entry.size;
        this.stats.entries--;
      }
    }

    for (const key of toDelete) {
      this.memory.delete(key);
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Persist cache to disk
   */
  persist(): void {
    const dir = this.config.persistPath;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const filePath = join(dir, `${this.config.namespace}.json`);
    const data: Record<string, CacheEntry<T>> = {};

    for (const [key, entry] of this.memory) {
      // Only persist non-expired entries
      if (Date.now() < entry.expiresAt) {
        data[key] = entry;
      }
    }

    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    const filePath = join(this.config.persistPath, `${this.config.namespace}.json`);
    
    if (!existsSync(filePath)) {
      return;
    }

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, CacheEntry<T>>;
      const now = Date.now();

      for (const [key, entry] of Object.entries(data)) {
        // Only load non-expired entries
        if (now < entry.expiresAt) {
          this.memory.set(key, entry);
          this.stats.size += entry.size;
          this.stats.entries++;
        }
      }
    } catch (error) {
      // Ignore parse errors
    }
  }

  /**
   * Get config
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.persist();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ========================
// LLM Response Cache
// ========================

interface LLMCacheKey {
  prompt: string;
  model: string;
  temperature: number;
}

class LLMCache extends Cache<string> {
  constructor(config: Partial<CacheConfig> = {}) {
    super({
      ...config,
      namespace: config.namespace ?? 'llm',
      ttl: config.ttl ?? 3600,  // 1 hour default for LLM responses
    });
  }

  /**
   * Get cached LLM response
   */
  getResponse(prompt: string, model: string, temperature: number = 0.7): string | undefined {
    const key: LLMCacheKey = { prompt, model, temperature };
    return this.get(key);
  }

  /**
   * Cache LLM response
   */
  setResponse(prompt: string, model: string, response: string, temperature: number = 0.7): void {
    const key: LLMCacheKey = { prompt, model, temperature };
    this.set(key, response);
  }
}

// ========================
// Singleton Instances
// ========================

const caches: Map<string, Cache> = new Map();

export function getCache<T = any>(namespace: string = 'default', config?: Partial<CacheConfig>): Cache<T> {
  let cache = caches.get(namespace);
  if (!cache) {
    cache = new Cache<T>({ ...config, namespace });
    caches.set(namespace, cache);
  }
  return cache as Cache<T>;
}

let llmCacheInstance: LLMCache | null = null;

export function getLLMCache(config?: Partial<CacheConfig>): LLMCache {
  if (!llmCacheInstance) {
    llmCacheInstance = new LLMCache(config);
  }
  return llmCacheInstance;
}

export { Cache, LLMCache, CacheConfig, CacheStats };
