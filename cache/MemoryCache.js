/**
 * ==========================================================
 * Nyvora Framework
 * ==========================================================
 *
 * @author      Satyam Kumar
 * @email       satyam.ku9725@gmail.com
 * @phone       +91 9725399936
 * @github      https://github.com/Satyam9725
 *
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 *
 * ==========================================================
 */

import Config from "../core/config.js";

class MemoryCache {
    constructor() {
        this.store = new Map();
        this.currentTotalSize = 0;
        
        // Background Garbage Collector to sweep expired keys every 30 seconds
        const gcInterval = setInterval(() => this._gc(), 30000);
        if (gcInterval && typeof gcInterval.unref === "function") {
            gcInterval.unref();
        }
    }

    /**
     * Store a value in memory with an optional TTL (in seconds)
     */
    set(key, value, ttlSeconds = 0) {
        if (!key) return false;

        const limit = this._getLimitBytes();
        const oldItem = this.store.get(key);
        const oldSize = oldItem ? (key.length * 2 + this._sizeof(oldItem.value) + 16) : 0;
        const newSize = key.length * 2 + this._sizeof(value) + 16;
        
        if (this.currentTotalSize - oldSize + newSize > limit) {
            console.warn(`⚠️ Cache limit exceeded: Cannot store key "${key}". Max size: ${Config.get("REDIS_DATABASE_SIZE") || "500MB"}`);
            return false;
        }

        const now = Date.now();
        const expiresAt = ttlSeconds > 0 ? now + (ttlSeconds * 1000) : null;

        this.store.set(key, {
            value,
            createdAt: now,
            expiresAt
        });
        
        this.currentTotalSize = this.currentTotalSize - oldSize + newSize;
        return true;
    }

    /**
     * Retrieve a value from memory if not expired
     */
    get(key, defaultValue = null) {
        if (!key || !this.store.has(key)) return defaultValue;

        const item = this.store.get(key);
        
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.del(key); // Expired (uses del to track size)
            return defaultValue;
        }

        return item.value;
    }

    /**
     * Check if a valid, non-expired key exists
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete a key from memory
     */
    del(key) {
        if (!this.store.has(key)) return false;
        const item = this.store.get(key);
        const size = key.length * 2 + this._sizeof(item.value) + 16;
        this.currentTotalSize -= size;
        return this.store.delete(key);
    }

    forget(key) {
        return this.del(key);
    }

    /**
     * Get a user-scoped cache instance
     * Usage: Vexora.Redis.user(101).set("username", "satyam")
     */
    user(userId) {
        return {
            set: (key, value, ttlSeconds = 0) => this.set(`user:${userId}:${key}`, value, ttlSeconds),
            get: (key, defaultValue = null) => this.get(`user:${userId}:${key}`, defaultValue),
            has: (key) => this.has(`user:${userId}:${key}`),
            del: (key) => this.del(`user:${userId}:${key}`),
            forget: (key) => this.del(`user:${userId}:${key}`)
        };
    }

    /**
     * Increment a numeric value (Redis-style INCR)
     */
    incr(key, amount = 1) {
        const current = this.get(key, 0);
        const val = (parseInt(current, 10) || 0) + amount;
        
        // Preserve remaining TTL if key existed
        const existingItem = this.store.get(key);
        const remainingTtl = existingItem && existingItem.expiresAt ? Math.max(1, Math.ceil((existingItem.expiresAt - Date.now()) / 1000)) : 0;
        
        this.set(key, val, remainingTtl);
        return val;
    }

    /**
     * Decrement a numeric value (Redis-style DECR)
     */
    decr(key, amount = 1) {
        return this.incr(key, -amount);
    }

    /**
     * Update or set TTL for an existing key (Redis-style EXPIRE)
     */
    expire(key, ttlSeconds) {
        if (!this.store.has(key)) return false;
        
        const item = this.store.get(key);
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.del(key);
            return false;
        }

        item.expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
        return true;
    }

    /**
     * Get remaining TTL in seconds for a key (Redis-style TTL)
     */
    ttl(key) {
        if (!this.store.has(key)) return -2; // Key does not exist
        const item = this.store.get(key);
        if (!item.expiresAt) return -1; // Persistent key
        
        const remaining = Math.ceil((item.expiresAt - Date.now()) / 1000);
        if (remaining <= 0) {
            this.del(key);
            return -2;
        }
        return remaining;
    }

    /**
     * Clear all cached keys (Redis-style FLUSHALL)
     */
    flush() {
        this.store.clear();
        this.currentTotalSize = 0;
        return true;
    }

    clear() {
        return this.flush();
    }

    /**
     * Get all active keys
     */
    keys() {
        const activeKeys = [];
        const now = Date.now();

        for (const [key, item] of this.store.entries()) {
            if (!item.expiresAt || now <= item.expiresAt) {
                activeKeys.push(key);
            }
        }
        return activeKeys;
    }

    /**
     * Garbage collector to sweep expired items
     */
    _gc() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (item.expiresAt && now > item.expiresAt) {
                this.del(key);
            }
        }
    }

    /**
     * Estimates size of a value in bytes using JSON serialization
     */
    _sizeof(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'boolean') return 4;
        if (typeof value === 'number') return 8;
        if (typeof value === 'string') return value.length * 2;
        if (typeof value === 'object') {
            if (Buffer.isBuffer(value)) return value.length;
            // Fast heuristic: average object size instead of expensive stringify
            return 256; 
        }
        return 64; // fallback for functions, etc
    }

    /**
     * Parses the max memory limit from config (in bytes)
     */
    _getLimitBytes() {
        const sizeStr = Config.get("REDIS_DATABASE_SIZE") || "500MB";
        const match = String(sizeStr).trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
        if (!match) return 500 * 1024 * 1024; // default 500MB
        const value = parseFloat(match[1]);
        const unit = (match[2] || "MB").toUpperCase();
        switch (unit) {
            case "GB": return value * 1024 * 1024 * 1024;
            case "MB": return value * 1024 * 1024;
            case "KB": return value * 1024;
            default: return value;
        }
    }

    /**
     * Computes total size of items currently held in store
     */
    getTotalSize() {
        return this.currentTotalSize;
    }

    /**
     * Format byte count into human-readable string
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get detailed status and usage of the Redis mock storage
     */
    info_redis() {
        const totalSize = this.getTotalSize();
        const limitBytes = this._getLimitBytes();
        const activeKeys = this.keys();
        const totalKeys = activeKeys.length;
        
        let persistentKeys = 0;
        let ttlKeys = 0;
        for (const key of activeKeys) {
            const item = this.store.get(key);
            if (item) {
                if (item.expiresAt) ttlKeys++;
                else persistentKeys++;
            }
        }
        
        const usagePercentage = ((totalSize / limitBytes) * 100).toFixed(2);
        
        return {
            status: "connected",
            total_keys: totalKeys,
            persistent_keys: persistentKeys,
            ttl_keys: ttlKeys,
            used_memory_bytes: totalSize,
            used_memory_human: this._formatBytes(totalSize),
            max_memory_bytes: limitBytes,
            max_memory_human: Config.get("REDIS_DATABASE_SIZE") || "500MB",
            memory_usage_percentage: `${usagePercentage}%`,
            keys: activeKeys
        };
    }

    INFO_REDIS() {
        return this.info_redis();
    }
}

export default new MemoryCache();
