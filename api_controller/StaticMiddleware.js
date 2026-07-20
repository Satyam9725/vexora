/**
 * ==========================================================
 * Vexora Framework - Static Files Serving Middleware
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

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4"
};

class StaticMiddleware {
    /**
     * Create a middleware handler to serve static assets from a directory
     * @param {string} staticDir Relative or absolute path to static root directory (default: 'public')
     * @param {Object} options Configuration options (e.g. maxAge)
     */
    static serve(staticDir = "public", options = {}) {
        const root = path.resolve(process.cwd(), staticDir);
        const maxAge = options.maxAge !== undefined ? options.maxAge : 86400; // Default 1 day caching

        return async (req, res) => {
            // Only handle GET and HEAD requests
            if (req.method !== "GET" && req.method !== "HEAD") {
                return false;
            }

            // Get clean path relative to mounting prefix
            let reqPath = req.path;
            
            // Decode path to handle URL encoded values
            try {
                reqPath = decodeURIComponent(reqPath);
            } catch (e) {
                // Ignore decoding errors, stick with raw path
            }

            // Resolve file location
            const targetFile = path.join(root, reqPath);

            // Block directory traversal (Ensure target file is inside static root directory)
            const relative = path.relative(root, targetFile);
            if (relative.startsWith("..") || path.isAbsolute(relative)) {
                return false; // Skip traversal targets, let route handler handle 404
            }

            try {
                const stats = await fs.promises.stat(targetFile);
                
                // If it is a directory, look for index.html
                if (stats.isDirectory()) {
                    const indexHtml = path.join(targetFile, "index.html");
                    try {
                        const indexStats = await fs.promises.stat(indexHtml);
                        if (indexStats.isFile()) {
                            return await StaticMiddleware._sendFile(res, indexHtml, indexStats, maxAge);
                        }
                    } catch {
                        // index.html doesn't exist, skip directory
                    }
                    return false;
                }

                if (stats.isFile()) {
                    return await StaticMiddleware._sendFile(res, targetFile, stats, maxAge);
                }
            } catch (err) {
                // File does not exist, let route controller continue
            }

            return false;
        };
    }

    static async _sendFile(res, filePath, stats, maxAge) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        const nativeRes = res.res || res;
        nativeRes.statusCode = 200;
        nativeRes.setHeader("Content-Type", contentType);
        nativeRes.setHeader("Content-Length", stats.size);

        if (maxAge > 0) {
            nativeRes.setHeader("Cache-Control", `public, max-age=${maxAge}`);
        } else {
            nativeRes.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }

        return new Promise((resolve) => {
            const stream = fs.createReadStream(filePath);
            stream.pipe(nativeRes);
            stream.on("end", () => resolve(true));
            stream.on("error", () => {
                if (!nativeRes.headersSent) {
                    nativeRes.statusCode = 500;
                    nativeRes.end("Internal Server Error");
                }
                resolve(true);
            });
        });
    }
}

export default StaticMiddleware;
