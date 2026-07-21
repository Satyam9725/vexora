/**
 * ==========================================================
 * Nyvora Framework - In-Memory Session Manager
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

import crypto from "crypto";
import MemoryCache from "../cache/MemoryCache.js";

class SessionManager {
    constructor() {
        // Sessions are stored entirely in RAM (MemoryCache) - zero disk writes
    }

    start(sessionId = null, lifetime = 3600) {
        if (!sessionId || !this._isValid(sessionId)) {
            const newId = crypto.randomUUID();
            const initialData = {
                _lifetime: lifetime,
                _createdAt: Date.now(),
                _accessedAt: Date.now()
            };
            this.set(newId, initialData);
            return newId;
        } else {
            const data = this.get(sessionId) || {};
            data._lifetime = lifetime;
            data._accessedAt = Date.now();
            this.set(sessionId, data);
            return sessionId;
        }
    }

    _isValid(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') return false;
        // Security: Reject oversized or malformed session IDs before cache lookup
        if (sessionId.length > 64) return false;
        if (!/^[a-f0-9\-]{36,64}$/.test(sessionId)) return false;
        return MemoryCache.has(`sess:${sessionId}`);
    }

    get(sessionId) {
        if (!sessionId) return null;
        return MemoryCache.get(`sess:${sessionId}`);
    }

    hasUserKeys(data) {
        if (!data || typeof data !== "object") return false;
        const keys = Object.keys(data).filter(k => !k.startsWith("_"));
        return keys.length > 0;
    }

    set(sessionId, data) {
        if (!sessionId) return false;
        const lifetime = data._lifetime || 3600;
        // Save dynamically into MemoryCache using TTL in seconds
        return MemoryCache.set(`sess:${sessionId}`, data, lifetime);
    }

    destroy(sessionId) {
        if (!sessionId) return;
        MemoryCache.del(`sess:${sessionId}`);
    }

    gc() {
        // Automatically handled by MemoryCache garbage collector
    }
}

export default new SessionManager();
