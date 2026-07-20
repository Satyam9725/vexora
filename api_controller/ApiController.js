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

class ApiController {
    static pathCache = new Map();
    static routerCache = new Map();
    static handleCache = new Map();

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
        let indexFile = findIndexFile(moduleName);

        // If URL has /api/ prefix (e.g. /api/auth/register) and api/index.js wasn't found, try the next part
        if (!indexFile && moduleName === 'api' && parts[1]) {
            moduleName = parts[1];
            baseMount = `/api/${moduleName}`;
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
