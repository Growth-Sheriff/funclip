"use strict";
/**
 * FuncLib v4 - Cache Layer
 *
 * LLM yanıtları ve diğer pahalı işlemler için cache.
 * Memory cache, disk persist, TTL desteği.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMCache = exports.Cache = void 0;
exports.getCache = getCache;
exports.getLLMCache = getLLMCache;
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
// ========================
// Cache Class
// ========================
class Cache {
    config;
    memory = new Map();
    stats = {
        hits: 0,
        misses: 0,
        size: 0,
        entries: 0,
        hitRate: 0,
    };
    cleanupInterval = null;
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            ttl: config.ttl ?? 3600, // 1 hour
            maxSize: config.maxSize ?? 100, // 100 MB
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
    generateKey(input) {
        const str = typeof input === 'string' ? input : JSON.stringify(input);
        return (0, crypto_1.createHash)('sha256').update(str).digest('hex').substring(0, 32);
    }
    /**
     * Calculate entry size in bytes
     */
    calculateSize(value) {
        const str = JSON.stringify(value);
        return Buffer.byteLength(str, 'utf-8');
    }
    /**
     * Get item from cache
     */
    get(key) {
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
    set(key, value, ttl) {
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
        const entry = {
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
    has(key) {
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
    delete(key) {
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
    clear() {
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
    async getOrSet(key, factory, ttl) {
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
    evictLRU() {
        let lruKey = null;
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
            const entry = this.memory.get(lruKey);
            this.memory.delete(lruKey);
            this.stats.size -= entry.size;
            this.stats.entries--;
        }
    }
    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        const toDelete = [];
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
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Persist cache to disk
     */
    persist() {
        const dir = this.config.persistPath;
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        const filePath = (0, path_1.join)(dir, `${this.config.namespace}.json`);
        const data = {};
        for (const [key, entry] of this.memory) {
            // Only persist non-expired entries
            if (Date.now() < entry.expiresAt) {
                data[key] = entry;
            }
        }
        (0, fs_1.writeFileSync)(filePath, JSON.stringify(data), 'utf-8');
    }
    /**
     * Load cache from disk
     */
    loadFromDisk() {
        const filePath = (0, path_1.join)(this.config.persistPath, `${this.config.namespace}.json`);
        if (!(0, fs_1.existsSync)(filePath)) {
            return;
        }
        try {
            const data = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf-8'));
            const now = Date.now();
            for (const [key, entry] of Object.entries(data)) {
                // Only load non-expired entries
                if (now < entry.expiresAt) {
                    this.memory.set(key, entry);
                    this.stats.size += entry.size;
                    this.stats.entries++;
                }
            }
        }
        catch (error) {
            // Ignore parse errors
        }
    }
    /**
     * Get config
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update config
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Cleanup resources
     */
    dispose() {
        this.persist();
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
exports.Cache = Cache;
class LLMCache extends Cache {
    constructor(config = {}) {
        super({
            ...config,
            namespace: config.namespace ?? 'llm',
            ttl: config.ttl ?? 3600, // 1 hour default for LLM responses
        });
    }
    /**
     * Get cached LLM response
     */
    getResponse(prompt, model, temperature = 0.7) {
        const key = { prompt, model, temperature };
        return this.get(key);
    }
    /**
     * Cache LLM response
     */
    setResponse(prompt, model, response, temperature = 0.7) {
        const key = { prompt, model, temperature };
        this.set(key, response);
    }
}
exports.LLMCache = LLMCache;
// ========================
// Singleton Instances
// ========================
const caches = new Map();
function getCache(namespace = 'default', config) {
    let cache = caches.get(namespace);
    if (!cache) {
        cache = new Cache({ ...config, namespace });
        caches.set(namespace, cache);
    }
    return cache;
}
let llmCacheInstance = null;
function getLLMCache(config) {
    if (!llmCacheInstance) {
        llmCacheInstance = new LLMCache(config);
    }
    return llmCacheInstance;
}
//# sourceMappingURL=cache.js.map