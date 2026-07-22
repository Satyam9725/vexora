/**
 * ==========================================================
 * Nyvora Framework - API Sub-Router Controller Manager
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
import createRouter from "../http/Router.js";
import { log as auditLog } from "../Middleware/audit_logger.js";

class ApiController {
    static pathCache = new Map();
    static routerCache = new Map();
    static handleCache = new Map();
    static fallbackApiRouter = null;

    /**
     * Centralized router handler for modular routes dynamically.
     * Auto-discovers sub-routers in root/http/api/controllers directories.
     */
    static async handle(req, res) {
        if (req.path === '/' || !req.path) return false;

        const cached = this.handleCache.get(req.path);
        if (cached === null) return false;
        if (cached !== undefined) {
            try {
                cached.subRouter.basePath = cached.baseMount;
                await cached.subRouter.run(req, res);
                return true;
            } catch (err) {
                if (err && err.message === "VEXORA_ROUTE_BLOCKED") return true;
                console.error(`❌ Dynamic Router load failed for: ${cached.moduleName}`, err);
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.json({ status: false, message: "Internal Server Error" });
                }
                return true;
            }
        }

        const parts = req.path.split('/').filter(Boolean); // e.g. ['auth', 'register'] or ['api', 'auth', 'register']
        if (parts.length === 0) {
            this.handleCache.set(req.path, null);
            return false;
        }

        // Auto-discover sub-routers or index.js files instead of matching individual files directly.

        const searchDirs = [
            process.cwd(),
            path.join(process.cwd(), 'http'),
            path.join(process.cwd(), 'api'),
            path.join(process.cwd(), 'controllers')
        ];

        const findIndexFile = (mod) => {
            if (this.pathCache.has(mod)) return this.pathCache.get(mod);
            for (const dir of searchDirs) {
                const candidate = path.join(dir, mod, 'index.js');
                if (fs.existsSync(candidate)) {
                    this.pathCache.set(mod, candidate);
                    return candidate;
                }
            }
            this.pathCache.set(mod, null);
            return null;
        };

        let moduleName = parts[0];
        let baseMount = `/${moduleName}`;
        let indexFile = undefined;

        // Check in .api_routes first if moduleName is 'api'
        if (moduleName === 'api') {
            let matchedDepth = 0;
            let currentPath = path.join(process.cwd(), '.api_routes');
            
            // Traverse down to find how deep the sub-directories go based on the URL parts
            const hasTrailingSlash = req.path.endsWith('/');
            for (let i = 1; i < parts.length; i++) {
                // If it is the last segment and has no trailing slash, do not treat it as a sub-router folder
                if (i === parts.length - 1 && !hasTrailingSlash) {
                    break;
                }
                const nextPath = path.join(currentPath, parts[i]);
                if (fs.existsSync(nextPath) && fs.statSync(nextPath).isDirectory()) {
                    currentPath = nextPath;
                    matchedDepth = i;
                } else {
                    break;
                }
            }

            // Search backwards from the deepest matched folder up to the root .api_routes folder
            // looking for the first api.whitelist.js or index.js
            for (let i = matchedDepth; i >= 0; i--) {
                const checkDir = path.join(process.cwd(), '.api_routes', ...parts.slice(1, i + 1));
                const wl = path.join(checkDir, 'api.whitelist.js');
                const idx = path.join(checkDir, 'index.js');
                
                if (fs.existsSync(wl)) {
                    indexFile = wl;
                    const joined = parts.slice(1, i + 1).join('/');
                    baseMount = joined ? `/api/${joined}` : '/api';
                    moduleName = parts[i] || 'api';
                    break;
                } else if (fs.existsSync(idx)) {
                    indexFile = idx;
                    const joined = parts.slice(1, i + 1).join('/');
                    baseMount = joined ? `/api/${joined}` : '/api';
                    moduleName = parts[i] || 'api';
                    break;
                }
            }
        } else {
            indexFile = findIndexFile(moduleName);
        }
        
        if (indexFile) {
            try {
                let subRouter = this.routerCache.get(indexFile);
                if (!subRouter) {
                    const fileUrl = pathToFileURL(indexFile).href;
                    const module = await import(fileUrl);
                    subRouter = module.default || module;
                    
                    // Automatically inject root fallback if not defined by the user
                    if (subRouter && typeof subRouter.match === 'function' && subRouter.routes) {
                        let hasRoot = false;
                        for (const method in subRouter.routes) {
                            if (subRouter.routes[method]['/']) {
                                hasRoot = true;
                                break;
                            }
                        }
                        if (!hasRoot && baseMount === '/api') {
                            subRouter.match(['GET', 'POST'], '/', (req, res) => {
                                return res.json({ status: true, message: "Vexora API is running" });
                            });
                        }
                    }
                    
                    this.routerCache.set(indexFile, subRouter);
                }
                
                if (subRouter && typeof subRouter.run === 'function') {
                    this.handleCache.set(req.path, { subRouter, baseMount, moduleName });
                    // Dynamically attach the matched base path prefix (either /auth or /api/auth)
                    subRouter.basePath = baseMount;
                    await subRouter.run(req, res);
                    return true; // Successfully matched and handled
                }
            } catch (err) {
                if (err && err.message === "VEXORA_ROUTE_BLOCKED") return true;
                let errorId = "N/A";
                let location = "";
                if (err.stack) {
                    const match = err.stack.match(/at file:.*?:(\d+):(\d+)/) || err.stack.match(/at .*\.js:(\d+):(\d+)/);
                    if (match) location = ` [Line ${match[1]}]`;
                }
                
                try {
                    errorId = auditLog("ERROR", "RUNTIME_ERROR", err.message + location, { module: moduleName });
                } catch (e) {}
                console.error(`❌ Dynamic Router load failed for: ${moduleName}${location} -`, err.message);
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.json({ status: false, message: `Internal Server Error (Error ID: ${errorId})` });
                }
                return true;
            }
        }
        
        this.handleCache.set(req.path, null);
        return false; // Did not match any modular router, fallback to static routes in test.js
    }
}

export default ApiController;
