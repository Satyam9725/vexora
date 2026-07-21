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
import { spawn } from "child_process";
import { RateLimiterClass } from "../security/RateLimiter.js";

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
    static serve(staticDir = "public", defaultIndexFile = "index.html", options = {}) {
        if (typeof defaultIndexFile === 'object') {
            options = defaultIndexFile;
            defaultIndexFile = "index.html";
        }
        const root = path.resolve(process.cwd(), staticDir);
        const maxAge = options.maxAge !== undefined ? options.maxAge : 0; // Default 0 (no cache / validate every time)

        let limiter = null;
        if (options.rateLimit) {
            const limitOpts = typeof options.rateLimit === 'object' ? options.rateLimit : {};
            limiter = new RateLimiterClass({
                isEnabled: true,
                maxRequests: limitOpts.maxRequests || 150,
                windowSeconds: limitOpts.windowSeconds || 60
            });
        }

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

            // Block access to sensitive files (dotfiles, db_config.json, node_modules, source files, etc.)
            const segments = reqPath.toLowerCase().split(/[\/\\]/);
            const isSensitive = segments.some(seg => 
                seg.startsWith(".") ||
                seg === "db_config.json" ||
                seg === "package.json" ||
                seg === "package-lock.json" ||
                seg === "node_modules" ||
                seg === "index.js" ||
                seg.endsWith(".env")
            );
            if (isSensitive) {
                return false;
            }

            const checkRateLimit = () => {
                if (limiter) {
                    const check = limiter.check(req);
                    if (!check.allowed) {
                        res.statusCode = 429;
                        res.json({
                            status: false,
                            message: `Too many requests for static assets. Please try again after ${check.retryAfter} seconds.`
                        });
                        return false;
                    }
                }
                return true;
            };

            try {
                const stats = await fs.promises.stat(targetFile);
                
                // If it is a directory, look for the configured defaultIndexFile
                if (stats.isDirectory()) {
                    let indexFile = path.join(targetFile, defaultIndexFile);
                    let found = false;
                    let indexStats;
                    
                    try {
                        indexStats = await fs.promises.stat(indexFile);
                        if (indexStats.isFile()) {
                            found = true;
                        }
                    } catch (e) {}
                    
                    // Fallback to index.php or index.html if the default is index.html and was not found
                    if (!found && defaultIndexFile === "index.html") {
                        const fallbackFiles = ["index.php", "index.html"];
                        for (const file of fallbackFiles) {
                            const candidate = path.join(targetFile, file);
                            try {
                                const candStats = await fs.promises.stat(candidate);
                                if (candStats.isFile()) {
                                    indexFile = candidate;
                                    indexStats = candStats;
                                    found = true;
                                    break;
                                }
                            } catch (e) {}
                        }
                    }
                    
                    if (found) {
                        if (!checkRateLimit()) return true;
                        const ext = path.extname(indexFile).toLowerCase();
                        if (ext === '.php' || ext === '.html' || ext === '.htm') {
                            return await StaticMiddleware._runPhpFile(res, indexFile, req);
                        }
                        return await StaticMiddleware._sendFile(res, indexFile, indexStats, maxAge, req);
                    }
                    
                    const accept = (req.headers && req.headers['accept']) || '';
                    const isHtml = accept.includes('text/html');

                    let customErrorHtml = null;
                    if (isHtml) {
                        try {
                            const root = process.cwd();
                            const paths = [
                                path.join(root, '.Vexora_error', '404.html'),
                                path.join(root, '.vexora_error', '404.html')
                            ];
                            for (const p of paths) {
                                if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                                    customErrorHtml = fs.readFileSync(p, 'utf8');
                                    break;
                                }
                            }
                        } catch (e) {}
                    }

                    const nativeRes = res.res || res;
                    nativeRes.statusCode = 404;
                    nativeRes.setHeader("Content-Type", "text/html; charset=utf-8");
                    if (customErrorHtml !== null) {
                        nativeRes.end(customErrorHtml);
                        return true;
                    }
                    const displayPath = '/' + path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
                    nativeRes.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404: Index File Not Found</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #ffffff;
            color: #0f172a;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .content {
            text-align: center;
            max-width: 480px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background-color: #f1f5f9;
            color: #475569;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .badge-dot {
            width: 6px;
            height: 6px;
            background-color: #ef4444;
            border-radius: 50%;
        }
        h1 {
            font-size: 2.25rem;
            font-weight: 800;
            letter-spacing: -0.025em;
            line-height: 1.25;
            margin-bottom: 12px;
            color: #0f172a;
        }
        p {
            color: #64748b;
            font-size: 1.05rem;
            line-height: 1.6;
            margin-bottom: 28px;
        }
        .path-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 32px;
        }
        .method {
            font-size: 0.75rem;
            font-weight: 700;
            color: #ef4444;
            background-color: #fef2f2;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
        }
        .path {
            font-family: 'JetBrains Mono', monospace;
            color: #334155;
            font-size: 0.85rem;
            word-break: break-all;
        }
        .brand {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            color: #94a3b8;
            letter-spacing: 0.05em;
        }
        .brand span {
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="content">
        <div class="badge">
            <span class="badge-dot"></span>
            404 Error
        </div>
        <h1>Index File Not Found</h1>
        <p>The requested directory does not contain the expected index document. Please place an index file at the following path:</p>
        
        <div class="path-container">
            <span class="method">GET</span>
            <span class="path">${displayPath}</span>
        </div>

        <div class="brand">
            ⚡ VEXORA <span>SERVER</span>
        </div>
    </div>
</body>
</html>`);
                    return true;
                }

                if (stats.isFile()) {
                    if (!checkRateLimit()) return true;
                    const ext = path.extname(targetFile).toLowerCase();
                    if (ext === '.php' || ext === '.html' || ext === '.htm') {
                        return await StaticMiddleware._runPhpFile(res, targetFile, req);
                    }
                    return await StaticMiddleware._sendFile(res, targetFile, stats, maxAge, req);
                }
            } catch (err) {
                // File does not exist, let route controller continue
            }

            return false;
        };
    }

    static async _sendFile(res, filePath, stats, maxAge, req = null) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        const nativeRes = res.res || res;
        const nativeReq = req ? (req.req || req) : null;

        // Generate ETag and Last-Modified headers
        const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`;
        const lastModified = stats.mtime.toUTCString();

        nativeRes.setHeader("Content-Type", contentType);
        nativeRes.setHeader("Content-Length", stats.size);
        nativeRes.setHeader("ETag", etag);
        nativeRes.setHeader("Last-Modified", lastModified);

        if (maxAge > 0) {
            nativeRes.setHeader("Cache-Control", `public, max-age=${maxAge}`);
        } else {
            nativeRes.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }

        // Handle conditional requests (304 Not Modified)
        if (nativeReq && nativeReq.headers) {
            const ifNoneMatch = nativeReq.headers["if-none-match"];
            const ifModifiedSince = nativeReq.headers["if-modified-since"];
            let notModified = false;

            if (ifNoneMatch) {
                const cleanIfNoneMatch = ifNoneMatch.trim();
                if (cleanIfNoneMatch === etag || cleanIfNoneMatch === etag.replace(/^W\//, '')) {
                    notModified = true;
                }
            } else if (ifModifiedSince) {
                try {
                    const ifModifiedSinceTime = Date.parse(ifModifiedSince);
                    if (!isNaN(ifModifiedSinceTime) && Math.floor(stats.mtime.getTime() / 1000) <= Math.floor(ifModifiedSinceTime / 1000)) {
                        notModified = true;
                    }
                } catch (e) {
                    // Ignore date parsing errors
                }
            }

            if (notModified) {
                nativeRes.statusCode = 304;
                nativeRes.end();
                return true;
            }
        }

        if (nativeReq && nativeReq.method === "HEAD") {
            nativeRes.statusCode = 200;
            nativeRes.end();
            return true;
        }

        nativeRes.statusCode = 200;

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

    static async _runPhpFile(res, filePath, req) {
        return new Promise((resolve) => {
            const env = {
                ...process.env,
                GATEWAY_INTERFACE: "CGI/1.1",
                SERVER_PROTOCOL: "HTTP/1.1",
                SERVER_SOFTWARE: "Vexora",
                REQUEST_METHOD: req.method || "GET",
                SCRIPT_FILENAME: filePath,
                REDIRECT_STATUS: "200",
                REQUEST_URI: req.url || req.path || "/",
                QUERY_STRING: req.url ? (req.url.split("?")[1] || "") : "",
                CONTENT_TYPE: req.headers ? (req.headers["content-type"] || "") : "",
                CONTENT_LENGTH: req.headers ? (req.headers["content-length"] || "") : "",
                HTTP_COOKIE: req.headers ? (req.headers["cookie"] || "") : "",
            };

            if (req.headers) {
                for (const [key, value] of Object.entries(req.headers)) {
                    const envKey = "HTTP_" + key.toUpperCase().replace(/-/g, "_");
                    env[envKey] = String(value);
                }
            }

            const child = spawn("php-cgi", [], { env });

            let responseHeaderSent = false;
            let buffer = Buffer.alloc(0);
            const nativeRes = res.res || res;

            child.stdout.on("data", (chunk) => {
                if (responseHeaderSent) {
                    nativeRes.write(chunk);
                } else {
                    buffer = Buffer.concat([buffer, chunk]);
                    
                    let headerEndIndex = buffer.indexOf("\r\n\r\n");
                    let delimiterLength = 4;
                    if (headerEndIndex === -1) {
                        headerEndIndex = buffer.indexOf("\n\n");
                        delimiterLength = 2;
                    }

                    if (headerEndIndex !== -1) {
                        const headersPart = buffer.slice(0, headerEndIndex).toString("utf8");
                        const bodyPart = buffer.slice(headerEndIndex + delimiterLength);

                        const lines = headersPart.split(/\r?\n/);
                        for (const line of lines) {
                            const colonIdx = line.indexOf(":");
                            if (colonIdx !== -1) {
                                const key = line.substring(0, colonIdx).trim();
                                const val = line.substring(colonIdx + 1).trim();
                                if (key.toLowerCase() === "status") {
                                    const statusCode = parseInt(val);
                                    if (!isNaN(statusCode)) {
                                        nativeRes.statusCode = statusCode;
                                    }
                                } else {
                                    nativeRes.setHeader(key, val);
                                }
                            }
                        }

                        responseHeaderSent = true;
                        if (bodyPart.length > 0) {
                            nativeRes.write(bodyPart);
                        }
                    }
                }
            });

            child.stderr.on("data", (chunk) => {
                console.error("PHP Error:", chunk.toString("utf8"));
            });

            child.on("close", (code) => {
                if (!responseHeaderSent) {
                    if (buffer.length > 0) {
                        nativeRes.write(buffer);
                    }
                }
                nativeRes.end();
                resolve(true);
            });

            child.on("error", (err) => {
                console.error("Failed to start php-cgi:", err);
                if (!nativeRes.headersSent) {
                    nativeRes.statusCode = 500;
                    nativeRes.end("Internal Server Error: Failed to execute script");
                }
                resolve(true);
            });

            if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
                if (req.rawBody !== undefined && req.rawBody !== null) {
                    child.stdin.write(req.rawBody);
                    child.stdin.end();
                } else {
                    child.stdin.end();
                }
            } else {
                child.stdin.end();
            }
        });
    }
}

export default StaticMiddleware;
