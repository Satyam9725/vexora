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
                console.error(`❌ Dynamic Router load failed for: ${cached.moduleName}`, err);
                res.statusCode = 500;
                res.json({ status: false, message: "Internal Server Error" });
                return true;
            }
        }

        const parts = req.path.split('/').filter(Boolean); // e.g. ['auth', 'register'] or ['api', 'auth', 'register']
        if (parts.length === 0) {
            this.handleCache.set(req.path, null);
            return false;
        }

        // 1. Direct file matching inside .Vexora_Api (high precedence)
        if (req.path.startsWith('/api/') || req.path === '/api') {
            let suffix = req.path.substring(4);
            if (suffix.startsWith('/')) suffix = suffix.substring(1);
            if (!suffix) suffix = 'index';

            // Check if this path matches a sub-folder that has its own index.js (a sub-router)
            // e.g. /api/auth/login where .Vexora_Api/auth/index.js exists
            const suffixParts = suffix.split('/').filter(Boolean);
            let hasSubRouter = false;
            if (suffixParts.length > 1) {
                const vexoraSubApiIndex = path.join(process.cwd(), '.Vexora_Api', suffixParts[0], 'index.js');
                if (fs.existsSync(vexoraSubApiIndex)) {
                    hasSubRouter = true;
                }
            }

            if (!hasSubRouter) {
                const vexoraApiDir = path.join(process.cwd(), '.Vexora_Api');
                const fileCandidates = [
                    path.join(vexoraApiDir, suffix + '.js'),
                    path.join(vexoraApiDir, suffix, 'index.js')
                ];

                let matchedFile = null;
                for (const cand of fileCandidates) {
                    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                        if (cand.endsWith('index.js')) {
                            // Allow routing through .Vexora_Api/index.js if it's a Router, otherwise execute directly
                            try {
                                const fileContent = fs.readFileSync(cand, 'utf8');
                                if (fileContent.includes('export default') || fileContent.includes('RouteController')) {
                                    continue; 
                                }
                            } catch {}
                        }
                        matchedFile = cand;
                        break;
                    }
                }

                if (matchedFile) {
                    if (!this.fallbackApiRouter) {
                        this.fallbackApiRouter = createRouter('/api');
                    }
                    const relPath = path.relative(process.cwd(), matchedFile);
                    const actionName = relPath.replace(/\.js$/, '');
                    try {
                        await this.fallbackApiRouter._executeAction(req, res, actionName);
                        return true;
                    } catch (err) {
                        console.error(`❌ Fallback API load failed for: ${actionName}`, err);
                        res.statusCode = 500;
                        res.json({ status: false, message: "Internal Server Error" });
                        return true;
                    }
                }
            }
        }

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

        // Check in .Vexora_Api first if moduleName is 'api'
        if (moduleName === 'api') {
            // Check for /api/auth/index.js inside .Vexora_Api
            if (parts[1]) {
                const vexoraSubApiIndex = path.join(process.cwd(), '.Vexora_Api', parts[1], 'index.js');
                if (fs.existsSync(vexoraSubApiIndex)) {
                    moduleName = parts[1];
                    indexFile = vexoraSubApiIndex;
                    baseMount = `/api/${moduleName}`;
                }
            }
            // Check for /api/index.js inside .Vexora_Api
            if (!indexFile) {
                const vexoraApiIndex = path.join(process.cwd(), '.Vexora_Api', 'index.js');
                if (fs.existsSync(vexoraApiIndex)) {
                    indexFile = vexoraApiIndex;
                    baseMount = '/api';
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
                console.error(`❌ Dynamic Router load failed for: ${moduleName}`, err);
                res.statusCode = 500;
                res.json({ status: false, message: "Internal Server Error" });
                return true;
            }
        }
        
        this.handleCache.set(req.path, null);
        return false; // Did not match any modular router, fallback to static routes in test.js
    }
}

export default ApiController;
