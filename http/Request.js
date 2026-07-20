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

import { requestContext } from "../core/Context.js";
import { trimValue } from "./request/TrimHelper.js";

class Request {
    static _getReq() {
        const store = requestContext.getStore();
        if (!store || !store.req) {
            throw new Error("Request context not found. Ensure this is called within a route handler.");
        }
        return store.req;
    }

    static all() {
        const req = this._getReq();
        const merged = { ...(req.query || {}), ...(req.body || {}) };
        return trimValue(merged);
    }

    static input(key = null, defaultValue = null) {
        if (key === null) return this.all();
        const req = this._getReq();
        
        let value = defaultValue;
        if (req.body && req.body[key] !== undefined) {
            value = req.body[key];
        } else if (req.query && req.query[key] !== undefined) {
            value = req.query[key];
        }
        
        return trimValue(value);
    }

    static post(key = null, defaultValue = null) {
        const req = this._getReq();
        if (key === null) return trimValue(req.body || {});
        
        const value = (req.body && req.body[key] !== undefined) ? req.body[key] : defaultValue;
        return trimValue(value);
    }

    static json(key = null) {
        const req = this._getReq();
        if (!this.isJson()) return key ? null : {};
        
        const data = trimValue(req.body || {});
        return key ? (data[key] !== undefined ? data[key] : null) : data;
    }

    static raw() {
        return this._getReq().rawBody || "";
    }

    static header(name) {
        const req = this._getReq();
        return req.headers[name.toLowerCase()] || null;
    }

    static headers() {
        return this._getReq().headers;
    }

    static ip() {
        const req = this._getReq();
        const cfIp = req.headers['cf-connecting-ip'];
        if (cfIp) return cfIp.trim();
        
        const xForwarded = req.headers['x-forwarded-for'];
        if (xForwarded) return xForwarded.split(',')[0].trim();
        
        return req.socket.remoteAddress || '0.0.0.0';
    }

    static isPost() {
        return this._getReq().method === 'POST';
    }

    static isAjax() {
        return this.header('X-Requested-With') === 'XMLHttpRequest';
    }

    static isJson() {
        const contentType = this.header('Content-Type') || '';
        return contentType.includes('application/json');
    }

    static has(key) {
        const req = this._getReq();
        return (req.body && req.body[key] !== undefined) || (req.query && req.query[key] !== undefined);
    }

    static filled(key) {
        const val = this.input(key);
        return val !== null && val !== '';
    }

    static only(keys) {
        const all = this.all();
        const filtered = {};
        for (const key of keys) {
            if (all[key] !== undefined) {
                filtered[key] = all[key];
            }
        }
        return filtered;
    }

    static except(keys) {
        const all = this.all();
        const filtered = { ...all };
        for (const key of keys) {
            delete filtered[key];
        }
        return filtered;
    }

    static path() {
        return this._getReq().path || "/";
    }
}

export default Request;
