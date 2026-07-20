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
import Helper from "../utils/Helper.js";

const ALLOWED = Object.freeze({ allowed: true });

class RateLimiter {
    constructor(options = {}) {
        this.requests = new Map();
        this.isEnabled = options.isEnabled !== undefined ? options.isEnabled : null;
        this.maxRequests = options.maxRequests || 100;
        this.windowSeconds = options.windowSeconds || 60;
        this.windowMs = this.windowSeconds * 1000;

        // Garbage collect old IP records every minute
        const cleanupInterval = setInterval(() => this._cleanup(), 60000);
        if (cleanupInterval && typeof cleanupInterval.unref === "function") {
            cleanupInterval.unref();
        }
    }

    _getClientIp(req) {
        return Helper.getClientIp(req);
    }

    _refreshConfig() {
        const enabledStr = Config.get("RATE_LIMIT_ENABLED");
        const maxReq = Config.number("RATE_LIMIT_REQUESTS", 100);
        if (maxReq === -1 || enabledStr === "false") {
            this.isEnabled = false;
            return;
        }
        this.isEnabled = true;
        this.maxRequests = maxReq;
        this.windowSeconds = Config.number("RATE_LIMIT_WINDOW", 60);
        this.windowMs = this.windowSeconds * 1000;
    }

    check(req) {
        if (this.isEnabled === null) {
            this._refreshConfig();
        }
        if (!this.isEnabled) {
            return ALLOWED;
        }

        const ip = this._getClientIp(req);
        const now = Date.now();
        const cutoff = now - this.windowMs;

        let record = this.requests.get(ip);
        if (!record) {
            record = { timestamps: [], head: 0 };
            this.requests.set(ip, record);
        }

        const timestamps = record.timestamps;

        // Advance head pointer past expired timestamps without O(N) array shifts
        while (record.head < timestamps.length && timestamps[record.head] <= cutoff) {
            record.head++;
        }

        // Compact array if head pointer moves significantly to conserve memory
        if (record.head > 32 && record.head > (timestamps.length >> 1)) {
            record.timestamps = timestamps.slice(record.head);
            record.head = 0;
        }

        const activeCount = record.timestamps.length - record.head;

        if (activeCount >= this.maxRequests) {
            const oldestActiveTimestamp = record.timestamps[record.head];
            const retryAfter = Math.ceil((oldestActiveTimestamp + this.windowMs - now) / 1000);
            return {
                allowed: false,
                ip,
                limit: this.maxRequests,
                window: this.windowSeconds,
                retryAfter: retryAfter > 0 ? retryAfter : 1
            };
        }

        record.timestamps.push(now);
        return {
            allowed: true,
            ip,
            remaining: this.maxRequests - (activeCount + 1)
        };
    }

    _cleanup() {
        const now = Date.now();
        const cutoff = now - this.windowMs;

        for (const [ip, record] of this.requests.entries()) {
            while (record.head < record.timestamps.length && record.timestamps[record.head] <= cutoff) {
                record.head++;
            }
            if (record.head >= record.timestamps.length) {
                this.requests.delete(ip);
            } else if (record.head > 0) {
                record.timestamps = record.timestamps.slice(record.head);
                record.head = 0;
            }
        }
    }
}

export { RateLimiter as RateLimiterClass };
export default new RateLimiter();
