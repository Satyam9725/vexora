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

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import MemoryCache from "../cache/MemoryCache.js";
import { log as auditLog } from "../Middleware/audit_logger.js";
import Helper from "../utils/Helper.js";
import { requestContext } from "../core/Context.js";

const EMPTY_PARAMS = Object.freeze({});
const controllerCache = new Map();

class Router {
    static ALL = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

    constructor(basePath = '') {
        this.basePath = this._normalizeUri(basePath);
        this.routes = {};
        this.rateLimits = {};
        this.lastRegisteredRoutes = [];
        this.routeMatchCache = new Map();
        this.handle = this.handle.bind(this);
        this.run = this.run.bind(this);
    }

    _normalizeUri(uri) {
        if (!uri) return '/';
        if (uri === '/') return '/';
        // Fast path for already normalized paths (starts with / and does not end with /)
        if (uri.charCodeAt(0) === 47 && uri.charCodeAt(uri.length - 1) !== 47) {
            return uri;
        }
        let clean = uri.trim();
        if (clean.length > 1 && clean.endsWith('/')) {
            clean = clean.slice(0, -1);
        }
        return clean.startsWith('/') ? clean : '/' + clean;
    }

    /**
     * Register a route for one or more HTTP methods.
     */
    match(methods, uri, action) {
        const normalizedUri = this._normalizeUri(uri);
        if (action === undefined) {
            action = normalizedUri.replace(/^\//, '');
            if (action === '') action = 'index';
        }
        this.lastRegisteredRoutes = [];
        if (this.routeMatchCache) {
            this.routeMatchCache.clear();
        }

        const methodsArray = Array.isArray(methods) ? methods : [methods];

        for (let method of methodsArray) {
            const m = String(method).toUpperCase();
            if (!this.routes[m]) {
                this.routes[m] = {};
            }
            this.routes[m][normalizedUri] = action;

            this.lastRegisteredRoutes.push({
                method: m,
                uri: normalizedUri
            });
        }

        return this;
    }

    /**
     * Automatically map any URL path like /auth/:action to controller file in directory (e.g. auth/:action.js)
     * Example: route.auto('/auth', 'auth');
     * URL /auth/login -> executes auth/login.js
     * URL /auth/register -> executes auth/register.js
     */
    auto(prefix = '/auth', directory = null) {
        const cleanPrefix = this._normalizeUri(prefix);
        const targetDir = directory || cleanPrefix.replace(/^\//, '');

        this.match(Router.ALL, `${cleanPrefix}/:action`, async (req, res, params) => {
            const action = params && params.action ? params.action : '';
            if (!action) {
                res.statusCode = 404;
                let message = "Route Not Found";
                const isApiRoute = req && req.path && (req.path === '/api' || req.path.startsWith('/api/'));
                if (isApiRoute) {
                    message = "API Route Not Found";
                    const parts = req.path.split('/').filter(Boolean);
                    if (parts.length >= 2) {
                        const folderName = parts[1];
                        const folderPath = path.join(process.cwd(), '.api_routes', folderName);
                        if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
                            message = "Invalid endpoint";
                        }
                    }
                }
                return res.json({ status: false, message });
            }
            return await this._executeAction(req, res, `${targetDir}/${action}`, params);
        });

        return this;
    }

    /**
     * Apply rate limiting to the last registered route(s).
     * @param {number} timeSeconds Window in seconds
     * @param {number} requests Maximum requests allowed
     */
    rateLimit(timeSeconds, requests) {
        for (const route of this.lastRegisteredRoutes) {
            const { method, uri } = route;
            if (!this.rateLimits[method]) {
                this.rateLimits[method] = {};
            }
            this.rateLimits[method][uri] = {
                time: timeSeconds,
                requests: requests
            };
        }
        return this;
    }

    get(uri, action) {
        return this.match(['GET'], uri, action);
    }

    post(uri, action) {
        return this.match(['POST'], uri, action);
    }

    put(uri, action) {
        return this.match(['PUT'], uri, action);
    }

    patch(uri, action) {
        return this.match(['PATCH'], uri, action);
    }

    delete(uri, action) {
        return this.match(['DELETE'], uri, action);
    }

    options(uri, action) {
        return this.match(['OPTIONS'], uri, action);
    }

    any(uri, action) {
        return this.match(Router.ALL, uri, action);
    }

    /**
     * Internal check for per-route rate limiting using RAM memory store
     */
    _checkRateLimit(req, uri, timeSeconds, maxRequests) {
        const ip = Helper.getClientIp(req);

        const cacheKey = `route_rl:${ip}:${uri}`;
        const now = Date.now();
        const currentData = MemoryCache.get(cacheKey);

        if (currentData) {
            if (now - currentData.startTime < (timeSeconds * 1000)) {
                if (currentData.hits >= maxRequests) {
                    const retryAfter = Math.ceil((currentData.startTime + (timeSeconds * 1000) - now) / 1000);
                    return { allowed: false, retryAfter };
                }
                currentData.hits += 1;
                const remainingTtl = Math.max(1, Math.ceil((currentData.expiresAt - now) / 1000));
                MemoryCache.set(cacheKey, currentData, remainingTtl);
                return { allowed: true };
            }
        }

        MemoryCache.set(cacheKey, {
            startTime: now,
            expiresAt: now + (timeSeconds * 1000),
            hits: 1
        }, timeSeconds);

        return { allowed: true };
    }

    _cacheRouteMatch(key, value) {
        // Security: Bound cache size to prevent memory exhaustion
        if (this.routeMatchCache.size > 10000) {
            this.routeMatchCache.clear();
        }
        this.routeMatchCache.set(key, value);
    }

    /**
     * Find matching route including parameterized routes like /auth/:action
     */
    _findRoute(method, uri) {
        const cacheKey = `${method}:${uri}`;
        const cached = this.routeMatchCache.get(cacheKey);
        if (cached !== undefined) {
            if (cached === null) return null;
            if (cached.paramKeys === undefined) {
                return cached;
            }
            const params = {};
            if (cached.paramKeys.length > 0) {
                const uriParts = uri.split('/').filter(Boolean);
                for (let i = 0; i < cached.paramKeys.length; i++) {
                    const pk = cached.paramKeys[i];
                    params[pk.name] = uriParts[pk.index];
                }
            }
            return { action: cached.action, params, routeUri: cached.routeUri };
        }

        if (this.routes[method] && this.routes[method][uri]) {
            const result = { action: this.routes[method][uri], params: EMPTY_PARAMS, routeUri: uri };
            this._cacheRouteMatch(cacheKey, result);
            return result;
        }

        if (!this.routes[method]) {
            this._cacheRouteMatch(cacheKey, null);
            return null;
        }

        const uriParts = uri.split('/').filter(Boolean);

        for (const routeUri in this.routes[method]) {
            if (routeUri.includes(':')) {
                const routeParts = routeUri.split('/').filter(Boolean);

                if (routeParts.length === uriParts.length) {
                    const params = {};
                    const paramKeys = [];
                    let matched = true;

                    for (let i = 0; i < routeParts.length; i++) {
                        if (routeParts[i].startsWith(':')) {
                            const paramName = routeParts[i].slice(1);
                            params[paramName] = uriParts[i];
                            paramKeys.push({ index: i, name: paramName });
                        } else if (routeParts[i] !== uriParts[i]) {
                            matched = false;
                            break;
                        }
                    }

                    if (matched) {
                        this._cacheRouteMatch(cacheKey, { action: this.routes[method][routeUri], routeUri, paramKeys });
                        return { action: this.routes[method][routeUri], params, routeUri };
                    }
                }
            }
        }

        this._cacheRouteMatch(cacheKey, null);
        return null;
    }

    /**
     * Helper to execute string action or function callback
     */
    async _executeAction(req, res, action, params = {}) {
        if (!requestContext.getStore() && req && res) {
            return await requestContext.run({ req, response: res }, () => this._executeAction(req, res, action, params));
        }

        if (typeof action === 'function') {
            return await action(req, res, params);
        }

        if (typeof action === 'string') {
            let fullPath = null;
            try {
                let decodedAction = action;
                try {
                    decodedAction = decodeURIComponent(action);
                } catch (e) {}

                let relPath = decodedAction.trim();

                const baseName = path.basename(relPath);
                const parts = relPath.split(/[\/\\]/).filter(Boolean);

                const projectRoot = process.cwd();

                // Security: Path Traversal Guard — validates resolved path stays within project root
                const _isInsideProject = (filePath) => {
                    const resolved = path.resolve(filePath);
                    return resolved.startsWith(projectRoot + path.sep) || resolved === projectRoot;
                };

                // 1. Direct path resolution
                const resolvedDirect = path.resolve(projectRoot, relPath);
                if (_isInsideProject(resolvedDirect)) {
                    const directCandidates = [
                        resolvedDirect,
                        resolvedDirect + '.js',
                        path.join(resolvedDirect, 'index.js')
                    ];

                    for (const file of directCandidates) {
                        if (_isInsideProject(file) && fs.existsSync(file) && fs.statSync(file).isFile()) {
                            fullPath = file;
                            break;
                        }
                    }
                }

                if (!fullPath) {
                    const searchDirs = [
                        process.cwd(),
                        this.basePath ? path.join(process.cwd(), path.basename(this.basePath)) : null,
                        this.basePath && this.basePath.startsWith('/api') ? path.join(process.cwd(), '.api_routes', this.basePath.replace(/^\/api/, '')) : null,
                        path.join(process.cwd(), '.api_routes'),
                        path.join(process.cwd(), 'http'),
                        path.join(process.cwd(), 'api'),
                        path.join(process.cwd(), 'controllers')
                    ].filter(Boolean);

                    for (const dir of searchDirs) {
                        const candidates = [
                            path.resolve(dir, relPath + '.js'),
                            path.resolve(dir, relPath),
                            path.resolve(dir, relPath, 'index.js'),
                            path.resolve(dir, relPath, `${baseName}.js`),
                            parts.length > 1 ? path.resolve(dir, parts[parts.length - 1] + '.js') : null,
                            parts.length > 1 ? path.resolve(dir, parts[parts.length - 1], `${parts[parts.length - 1]}.js`) : null,
                        ].filter(Boolean);

                        for (const cand of candidates) {
                            if (_isInsideProject(cand) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                                fullPath = cand;
                                break;
                            }
                        }
                        if (fullPath) break;
                    }
                }

                if (!fullPath) {
                    console.error(`❌ Controller Not Found for action: ${action}`);
                    res.statusCode = 404;
                    let message = "Route Not Found";
                    const isApiRoute = req && req.path && (req.path === '/api' || req.path.startsWith('/api/'));
                    if (isApiRoute) {
                        message = "API Route Not Found";
                        const parts = req.path.split('/').filter(Boolean);
                        if (parts.length >= 2) {
                            const folderName = parts[1];
                            const folderPath = path.join(process.cwd(), '.api_routes', folderName);
                            if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
                                message = "Invalid endpoint";
                            }
                        }
                    }
                    return res.json({
                        status: false,
                        message
                    });
                }

                let cachedController = controllerCache.get(fullPath);
                let currentMtime = 0;
                try {
                    currentMtime = fs.statSync(fullPath).mtimeMs;
                } catch (e) {}

                if (cachedController && cachedController.mtimeMs === currentMtime) {
                    if (cachedController.isEsModule) {
                        if (typeof cachedController.handler === 'function') {
                            return await cachedController.handler(req, res, params);
                        } else {
                            return res.json(cachedController.handler);
                        }
                    } else {
                        return await cachedController.handler(Vexora, req, res, Vexora.db, params);
                    }
                }

                const fileContent = fs.readFileSync(fullPath, 'utf8');

                let cachedEntry;
                if (fileContent.includes('export default') || fileContent.includes('export const') || (fileContent.includes('import ') && !fileContent.includes('//import'))) {
                    const fileUrl = pathToFileURL(fullPath).href;
                    const module = await import(fileUrl);
                    const handler = module.default || module;
                    cachedEntry = { isEsModule: true, handler };
                } else {
                    let processedContent = fileContent.trim();
                    const scriptLines = processedContent.split('\n').map(l => l.trim()).filter(Boolean);
                    const lastLine = scriptLines[scriptLines.length - 1] || '';

                    if (lastLine && !lastLine.startsWith('return ') && (lastLine.startsWith('Vexora.Response') || lastLine.startsWith('res.') || lastLine.startsWith('Response.'))) {
                        const lastLineIdx = processedContent.lastIndexOf(lastLine);
                        processedContent = processedContent.substring(0, lastLineIdx) + 'return ' + lastLine;
                    }

                    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                    const handler = new AsyncFunction('Vexora', 'req', 'res', 'db', 'params', processedContent);
                    cachedEntry = { isEsModule: false, handler };
                }

                cachedEntry.mtimeMs = currentMtime;
                controllerCache.set(fullPath, cachedEntry);

                if (cachedEntry.isEsModule) {
                    if (typeof cachedEntry.handler === 'function') {
                        return await cachedEntry.handler(req, res, params);
                    } else {
                        return res.json(cachedEntry.handler);
                    }
                } else {
                    return await cachedEntry.handler(Vexora, req, res, Vexora.db, params);
                }
            } catch (err) {
                let errorId = "N/A";
                let location = "";
                if (err.stack) {
                    // Extract line number from AsyncFunction eval
                    const evalMatch = err.stack.match(/<anonymous>:(\d+):(\d+)/) || err.stack.match(/eval.*?:(\d+):(\d+)/) || err.stack.match(/at .*?:(\d+):(\d+)/);
                    if (evalMatch) {
                        // AsyncFunction wraps code in 2 lines of signature
                        const lineNum = Math.max(1, parseInt(evalMatch[1]) - 2); 
                        location = ` [Line ${lineNum}]`;
                    }
                }

                try {
                    const relativeFile = fullPath ? path.relative(process.cwd(), fullPath) : action;
                    errorId = auditLog("ERROR", "RUNTIME_ERROR", err.message + location, {
                        file: relativeFile
                    });
                } catch (logErr) {
                    console.error("❌ Failed to write audit log:", logErr.message);
                }
                console.error(`❌ Controller Execution Failed (Error ID: ${errorId})${location}: ${err.message}`);
                
                if (res.headersSent || res.writableEnded) {
                    return false;
                }

                res.statusCode = 500;
                // Security: Do NOT leak internal error details to clients
                return res.json({
                    status: false,
                    message: `Internal Server Error (Error ID: ${errorId})`
                });
            }
        }

        return action;
    }

    /**
     * Execute the router against the incoming request and response
     */
    async handle(req, res) {
        const method = (req.method || 'GET').toUpperCase();
        let uri = this._normalizeUri(req.path || req.url || '/');

        // Strip basePath if present (e.g. /auth/login -> /login)
        if (this.basePath && this.basePath !== '/') {
            if (uri.startsWith(this.basePath)) {
                uri = this._normalizeUri(uri.substring(this.basePath.length));
            }
        }

        // 1. Auto-handle CORS OPTIONS Preflight if no custom OPTIONS route
        if (method === 'OPTIONS' && (!this.routes['OPTIONS'] || !this.routes['OPTIONS'][uri])) {
            res.statusCode = 200;
            res.end();
            return true;
        }

        // 2. Check if matching route exists
        const matched = this._findRoute(method, uri);

        if (matched) {
            const { action, params, routeUri } = matched;

            // 3. Check Per-Route Rate Limiting
            if (this.rateLimits[method] && this.rateLimits[method][routeUri]) {
                const limit = this.rateLimits[method][routeUri];
                const check = this._checkRateLimit(req, routeUri, limit.time, limit.requests);
                if (!check.allowed) {
                    res.statusCode = 429;
                    return res.json({
                        status: false,
                        message: `Too Many Requests. Please try again after ${check.retryAfter} seconds.`,
                        retryAfterSeconds: check.retryAfter
                    });
                }
            }

            // 4. Execute Action
            return await this._executeAction(req, res, action, params);
        }

        // 5. Check Method Not Allowed (405)
        for (const m in this.routes) {
            if (this.routes[m][uri]) {
                res.statusCode = 405;
                res.json({
                    status: false,
                    message: "Method Not Allowed"
                });
                return true;
            }
        }

        // 6. Return false to let fallback handlers execute
        return false;
    }

    run(req, res) {
        return this.handle(req, res);
    }
}

export default function createRouter(basePath = '') {
    return new Router(basePath);
}
export { Router };
