/**
 * FuncLib v4 - Cache Layer
 *
 * LLM yanıtları ve diğer pahalı işlemler için cache.
 * Memory cache, disk persist, TTL desteği.
 */
interface CacheConfig {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    persistPath: string;
    namespace: string;
}
interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    entries: number;
    hitRate: number;
}
declare class Cache<T = any> {
    private config;
    private memory;
    private stats;
    private cleanupInterval;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Generate cache key from input
     */
    private generateKey;
    /**
     * Calculate entry size in bytes
     */
    private calculateSize;
    /**
     * Get item from cache
     */
    get(key: string | object): T | undefined;
    /**
     * Set item in cache
     */
    set(key: string | object, value: T, ttl?: number): void;
    /**
     * Check if key exists and is valid
     */
    has(key: string | object): boolean;
    /**
     * Delete item from cache
     */
    delete(key: string | object): boolean;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get or set with factory function
     */
    getOrSet(key: string | object, factory: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Cleanup expired entries
     */
    cleanup(): void;
    /**
     * Update hit rate
     */
    private updateHitRate;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Persist cache to disk
     */
    persist(): void;
    /**
     * Load cache from disk
     */
    private loadFromDisk;
    /**
     * Get config
     */
    getConfig(): CacheConfig;
    /**
     * Update config
     */
    setConfig(config: Partial<CacheConfig>): void;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
declare class LLMCache extends Cache<string> {
    constructor(config?: Partial<CacheConfig>);
    /**
     * Get cached LLM response
     */
    getResponse(prompt: string, model: string, temperature?: number): string | undefined;
    /**
     * Cache LLM response
     */
    setResponse(prompt: string, model: string, response: string, temperature?: number): void;
}
export declare function getCache<T = any>(namespace?: string, config?: Partial<CacheConfig>): Cache<T>;
export declare function getLLMCache(config?: Partial<CacheConfig>): LLMCache;
export { Cache, LLMCache, CacheConfig, CacheStats };
