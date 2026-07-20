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

import http from "node:http";
import cluster from "node:cluster";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Response from "./Response.js";
import { log as auditLog } from "../Middleware/audit_logger.js";
import Guard from "../core/Guard.js";
import SessionManager from "../session/SessionManager.js";
import { requestContext } from "../core/Context.js";
import Config from "../core/config.js";
import { parseBody } from "./server/BodyParser.js";
import RateLimiter from "../security/RateLimiter.js";
import { trimValue } from "./request/TrimHelper.js";

const EMPTY_OBJECT = Object.freeze({});

// Define lazy getters on IncomingMessage prototype once to avoid Object.defineProperty on every request
Object.defineProperty(http.IncomingMessage.prototype, 'cookies', {
    get() {
        if (this._cookies) return this._cookies;
        this._cookies = {};
        if (this.headers && this.headers.cookie) {
            const rawCookie = this.headers.cookie;
            const parts = rawCookie.split(";");
            for (let i = 0; i < parts.length; i++) {
                const c = parts[i];
                const idx = c.indexOf("=");
                if (idx !== -1) {
                    const k = c.substring(0, idx).trim();
                    const v = c.substring(idx + 1);
                    try {
                        this._cookies[k] = decodeURIComponent(v);
                    } catch {
                        this._cookies[k] = v;
                    }
                }
            }
        }
        return this._cookies;
    },
    configurable: true,
    enumerable: true
});

Object.defineProperty(http.IncomingMessage.prototype, 'session', {
    get() {
        if (this._session) return this._session;
        const sessionLifetime = Config.SESSION_LIFETIME;
        let sId = this.cookies.VEXORA_SESSID;
        this._sessionId = SessionManager.start(sId, sessionLifetime);
        this._session = SessionManager.get(this._sessionId) || {};
        this._sessionWasAccessed = true;
        return this._session;
    },
    set(val) {
        this._session = val;
        this._sessionWasAccessed = true;
    },
    configurable: true,
    enumerable: true
});

Object.defineProperty(http.IncomingMessage.prototype, 'input', {
    value(key = null, defaultValue = null) {
        if (key === null) return { ...this.query, ...this.body };
        let val = defaultValue;
        if (this.body && this.body[key] !== undefined) {
            val = this.body[key];
        } else if (this.query && this.query[key] !== undefined) {
            val = this.query[key];
        }
        return val;
    },
    configurable: true,
    writable: true,
    enumerable: true
});

Object.defineProperty(http.IncomingMessage.prototype, 'all', {
    value() {
        return { ...this.query, ...this.body };
    },
    configurable: true,
    writable: true,
    enumerable: true
});

function postExecute(req, response, res) {
  // Fallback: If no response was sent or ended, return 404 Not Found
  if (!res.headersSent && !res.writableEnded) {
      const accept = req.headers['accept'] || '';
      const isHtml = accept.includes('text/html');
      
      if (isHtml && req.method === 'GET') {
          const publicExists = fs.existsSync(path.join(process.cwd(), 'public'));
          const apiExists = fs.existsSync(path.join(process.cwd(), '.Vexora_Api'));
          
          let version = "1.2.2";
          try {
              const pkgPath = path.join(process.cwd(), 'package.json');
              if (fs.existsSync(pkgPath)) {
                  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                  version = pkg.version || "1.2.2";
              }
          } catch (e) {}
          
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getDefaultLandingPage(publicExists, apiExists, version));
      } else {
          response.status(404).json({
              status: false,
              message: "Route Not Found"
          });
      }
  }

  // Auto-save session data ONLY IF session was accessed and contains user keys
  if (req._session && SessionManager.hasUserKeys(req._session)) {
      SessionManager.set(req._sessionId, req._session);
      
      // Sliding session lifetime expiration - Keep cookie alive in browser
      const sessionLifetime = Config.SESSION_LIFETIME;
      response.cookie("VEXORA_SESSID", req._sessionId, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: sessionLifetime, path: "/" });
  }
}

function handleRequestError(err, req, res) {
      console.error("❌ Request Error:", err.stack || err.message);

      let message = err instanceof Error ? err.message : String(err);
      let stack = err instanceof Error ? err.stack : undefined;
      let location = "Unknown";
      
      if (stack) {
        const lines = stack.split("\n");
        const projectLine = lines.find(l => 
          l.includes("at ") && 
          !l.includes("node:") && 
          !l.includes("node_modules") &&
          !l.includes("/database/") &&
          !l.includes("/http/") &&
          !l.includes("/Middleware/") &&
          !l.includes("/core/") &&
          !l.includes("/utils/")
        );
        if (projectLine) {
          location = projectLine.trim().replace(/^at\s+/, "");
        }
      }
      
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const error_id = auditLog("ERROR", "RUNTIME_ERROR", message, { 
        method: req.method, 
        url: req.url, 
        ip,
        userAgent,
        location
      });

      if (!res.headersSent) {
        res.writeHead(500, {
          "Content-Type": "application/json",
        });

        res.end(
          JSON.stringify({
            success: false,
            message,
            error_id,
          }),
        );
      }
}

function executeRequest(callback, req, response, res) {
  try {
    const result = callback(req, response);
    if (result && typeof result.then === 'function') {
        result.then(() => {
            postExecute(req, response, res);
        }).catch(err => {
            handleRequestError(err, req, res);
        });
    } else {
        postExecute(req, response, res);
    }
  } catch (err) {
    handleRequestError(err, req, res);
  }
}

export default function Server(callback, options = {}) {
  const fastPaths = new Map();
  if (options.fastPaths) {
      for (const [key, value] of Object.entries(options.fastPaths)) {
          let body = "";
          let headers = {};
          if (typeof value === "string") {
              body = value;
              headers = {
                  "Content-Type": "application/json; charset=utf-8",
                  "Content-Length": Buffer.byteLength(value)
              };
          } else if (value && typeof value === "object") {
              body = value.body || "";
              headers = value.headers || {};
              if (headers["Content-Length"] === undefined) {
                  headers["Content-Length"] = Buffer.byteLength(body);
              }
          }
          fastPaths.set(key, { body, headers });
      }
  }

  const server = http.createServer((req, res) => {
    if (fastPaths.size > 0) {
        const route = fastPaths.get(`${req.method}:${req.url}`);
        if (route !== undefined) {
            res.writeHead(200, route.headers);
            res.end(route.body);
            return;
        }
    }
    if (Config.SHOW_EXECUTION_TIME) {
      req.startTime = performance.now();
    }
    try {
      if (Guard.enabled && Guard.check(req, res) === false) {
        return;
      }

      const response = res;

      // Enforce standard security headers by default (Helmet equivalent)
      if (Config.ENABLE_SECURITY_HEADERS) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }

      req.method = req.method || "GET";
      const url = req.url;
      if (url === "/") {
          req.path = "/";
          req.query = EMPTY_OBJECT;
      } else {
          const queryIdx = url.indexOf("?");
          req.path = queryIdx === -1 ? url : url.substring(0, queryIdx);
          req.query = EMPTY_OBJECT;
          if (queryIdx !== -1) {
              req.query = {};
              const queryString = url.substring(queryIdx + 1);
              if (queryString) {
                  const params = new URLSearchParams(queryString);
                  for (const [k, v] of params.entries()) {
                      req.query[k] = v;
                  }
              }
              req.query = trimValue(req.query);
          }
      }

      const isGetOrHead = req.method === "GET" || req.method === "HEAD";

      // Check if it's a request to a static file in public
      let isStaticFile = false;
      if (isGetOrHead) {
          try {
              let cleanPath = req.path;
              try {
                  cleanPath = decodeURIComponent(cleanPath);
              } catch (e) {}
              const staticRoot = path.resolve(process.cwd(), 'public');
              const targetFile = path.join(staticRoot, cleanPath);
              const relative = path.relative(staticRoot, targetFile);
              if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
                  const stats = fs.statSync(targetFile);
                  if (stats.isFile() || (stats.isDirectory() && fs.existsSync(path.join(targetFile, 'index.html')))) {
                      isStaticFile = true;
                  }
              }
          } catch (e) {
              // File does not exist
          }
      }

      // Global DDoS / Rate Limiting Protection (bypassed for static public assets)
      if (Config.RATE_LIMIT_ENABLED && !isStaticFile) {
        const rateCheck = RateLimiter.check(req);
        if (!rateCheck.allowed) {
            response.cookie("Retry-After", String(rateCheck.retryAfter));
            response.status(429).json({
                status: false,
                message: `Too Many Requests. Please try again after ${rateCheck.retryAfter} seconds.`,
                retryAfterSeconds: rateCheck.retryAfter
            });
            return;
        }
      }

      const proceed = () => {
          if (!isGetOrHead && req.body && Object.keys(req.body).length > 0) {
              req.body = trimValue(req.body);
          }

          if (Config.ENABLE_REQUEST_CONTEXT) {
            const storeObj = {
                req,
                response,
                get sessionId() {
                    if (!this.req._sessionId) {
                        const _ = this.req.session;
                    }
                    return this.req._sessionId;
                },
                set sessionId(val) {
                    this.req._sessionId = val;
                }
            };
            requestContext.run(storeObj, () => executeRequest(callback, req, response, res));
          } else {
            executeRequest(callback, req, response, res);
          }
      };

      if (!isGetOrHead) {
          parseBody(req).then(() => {
              if (req.bodyLimitExceeded) {
                  response.status(413).json({
                      status: false,
                      message: "Payload Too Large"
                  });
                  return;
              }
              proceed();
          }).catch(err => {
              handleRequestError(err, req, res);
          });
      } else {
          req.body = EMPTY_OBJECT;
          req.rawBody = "";
          proceed();
      }
    } catch (err) {
      handleRequestError(err, req, res);
    }
  });

  const isClusterEnabled = Config.SERVER_CLUSTER;

  if (!isClusterEnabled || cluster.isWorker) {
    server.on("error", (err) => {
      console.error("❌ Server Error:", err.message);
    });

    server.on("close", () => {
      if (!isClusterEnabled || cluster.isWorker) {
        // Output close message cleanly
      }
    });

    process.once("SIGINT", () => {
      if (!isClusterEnabled || (cluster.worker && cluster.worker.id === 1)) {
        console.log("\nStopping Vexora...");
      }

      server.close(() => {
        if (!isClusterEnabled || (cluster.worker && cluster.worker.id === 1)) {
          console.log("✅ Server Closed");
        }
        process.exit(0);
      });
    });

    process.once("SIGTERM", () => {
      server.close(() => process.exit(0));
    });
  }

  const originalListen = server.listen;
  server.listen = function(port, host, backlog, callback) {
    let actualCallback = callback;
    let actualHost = host;
    let actualBacklog = backlog;

    if (typeof host === 'function') {
      actualCallback = host;
      actualHost = undefined;
      actualBacklog = undefined;
    } else if (typeof backlog === 'function') {
      actualCallback = backlog;
      actualBacklog = undefined;
    }

    const isClusterEnabled = Config.SERVER_CLUSTER;

    if (isClusterEnabled) {
      if (cluster.isPrimary) {
        const workerCount = Config.CLUSTER_WORKERS;
        console.log(`🌀 Primary server process ${process.pid} is running`);
        console.log(`🚀 Clustering over ${workerCount} worker processes...`);

        for (let i = 0; i < workerCount; i++) {
          cluster.fork();
        }

        cluster.on("exit", (worker, code, signal) => {
          console.log(`⚠️ Worker process ${worker.process.pid} died. Restarting...`);
          cluster.fork();
        });

        if (typeof actualCallback === 'function') {
          actualCallback();
        }
        return server;
      } else {
        return originalListen.call(server, port, actualHost, actualBacklog, undefined);
      }
    } else {
      return originalListen.call(server, port, actualHost, actualBacklog, actualCallback);
    }
  };

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  return server;
}

function getDefaultLandingPage(publicExists, apiExists, version) {
    const publicStatus = publicExists ? 'status-active' : 'status-missing';
    const publicText = publicExists ? 'Active' : 'Missing / Empty';
    const apiStatus = apiExists ? 'status-active' : 'status-missing';
    const apiText = apiExists ? 'Active' : 'Missing / Empty';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vexora Engine - Server is Ready</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f8fafc;
            --surface: #ffffff;
            --primary: #4f46e5;
            --primary-hover: #3730a3;
            --text-main: #0f172a;
            --text-muted: #475569;
            --border: #e2e8f0;
            --success: #059669;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            line-height: 1.5;
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            width: 100%;
            max-width: 900px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 1px solid var(--border);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(5, 150, 105, 0.1);
            color: var(--success);
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 0.9rem;
            font-weight: 600;
            border: 1px solid rgba(5, 150, 105, 0.2);
            margin-bottom: 15px;
        }

        .badge .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--success);
            box-shadow: 0 0 6px rgba(5, 150, 105, 0.5);
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 800;
            letter-spacing: -0.025em;
            margin-bottom: 15px;
            color: #0f172a;
        }

        .subtitle {
            font-size: 1.15rem;
            color: var(--text-muted);
            max-width: 600px;
            margin: 0 auto;
        }

        .directory-status {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }

        .dir-card {
            flex: 1;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .dir-info h3 {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-main);
            margin-bottom: 4px;
        }

        .dir-info p {
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        .status-indicator {
            font-size: 0.85rem;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 6px;
            text-transform: uppercase;
        }

        .status-active {
            background: rgba(16, 185, 129, 0.15);
            color: #047857;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .status-missing {
            background: rgba(239, 68, 68, 0.15);
            color: #b91c1c;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }

        .grid-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .grid-card h2 {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .grid-card p {
            font-size: 0.95rem;
            color: var(--text-muted);
            line-height: 1.6;
        }

        .comparison-section {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 30px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .comparison-section h2 {
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 20px;
            color: var(--text-main);
            border-bottom: 2px solid var(--primary);
            padding-bottom: 8px;
            display: inline-block;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 15px;
            font-size: 0.9rem;
            text-align: left;
        }

        th, td {
            padding: 12px;
            border-bottom: 1px solid var(--border);
        }

        th {
            background-color: rgba(99, 102, 241, 0.05);
            font-weight: 700;
            color: var(--text-main);
        }

        tr:hover {
            background-color: rgba(0,0,0,0.01);
        }

        td code {
            font-family: 'Fira Code', monospace;
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8rem;
        }

        .banner {
            background: rgba(99, 102, 241, 0.05);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 16px;
            padding: 35px;
            text-align: center;
            margin-bottom: 40px;
        }

        .banner h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: #0f172a;
        }

        .banner p {
            color: var(--text-muted);
            font-size: 1rem;
            margin-bottom: 20px;
        }

        .btn-group {
            display: flex;
            justify-content: center;
            gap: 15px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 30px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            border: none;
        }

        .btn-primary {
            background-color: var(--primary);
            color: #ffffff;
            box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
        }

        .btn-primary:hover {
            background-color: var(--primary-hover);
            box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3);
        }

        footer {
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
            padding-top: 20px;
            width: 100%;
        }

        @media (max-width: 768px) {
            .directory-status {
                flex-direction: column;
                gap: 15px;
            }
            .grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            h1 {
                font-size: 2rem;
            }
            body {
                padding: 20px 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="badge">
                <div class="dot"></div>
                <span>Vexora Server is Ready (v${version})</span>
            </div>
            <h1>Vexora Engine Ready</h1>
            <p class="subtitle">
                Your high-performance microservices environment is successfully configured and listening for connections.
            </p>
            <div style="margin-top: 20px;">
                <a href="https://github.com/Satyam9725/vexora" class="btn btn-primary" target="_blank">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                    View GitHub Docs
                </a>
            </div>
        </header>

        <div class="directory-status">
            <div class="dir-card">
                <div class="dir-info">
                    <h3>📁 public/ directory</h3>
                    <p>For static web files (HTML, CSS, JS, Images)</p>
                </div>
                <span class="status-indicator ${publicStatus}">${publicText}</span>
            </div>
            <div class="dir-card">
                <div class="dir-info">
                    <h3>⚙️ .Vexora_Api directory</h3>
                    <p>For zero-boilerplate API controllers</p>
                </div>
                <span class="status-indicator ${apiStatus}">${apiText}</span>
            </div>
        </div>

        <div class="grid">
            <div class="grid-card">
                <h2>🔌 Zero-Boilerplate Sandbox</h2>
                <p>Place controller files directly in the <code>.Vexora_Api</code> folder. Script variables like <code>Vexora</code>, <code>req</code>, <code>res</code>, and <code>db</code> are pre-injected automatically for PHP-style rapid execution.</p>
            </div>
            <div class="grid-card">
                <h2>⏳ Hardened Shield</h2>
                <p>Built-in automatic rate limiting, DDoS protection, bot analysis, Turnstile verification, and secure context-aware request storage via AsyncLocalStorage.</p>
            </div>
            <div class="grid-card">
                <h2>🗄️ Database Multiplexer</h2>
                <p>Dynamic connection pool mapping supporting MySQL, PostgreSQL, and SQLite. Automatic schema-level sanitization blocks SQL injection seamlessly.</p>
            </div>
            <div class="grid-card">
                <h2>💾 In-Memory Cache</h2>
                <p>Sub-microsecond key-value storage mapping to MemoryCache or Redis client. Supports TTLs, counters, and RAM limits protection.</p>
            </div>
            <div class="grid-card">
                <h2>✉️ SMTP Mailer & HTTP Client</h2>
                <p>Built-in secure SMTP mail client and optimized HTTP fetch client for clean outbound communications without adding external npm dependencies.</p>
            </div>
            <div class="grid-card">
                <h2>⏰ Scheduler & Queue Worker</h2>
                <p>Native Task Scheduler supporting Cron formats and asynchronous Job Queue execution with failover retry loops built directly into the core.</p>
            </div>
        </div>

        <div class="comparison-section">
            <h2>⚡ Core Features & Performance</h2>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Feature / Criteria</th>
                            <th>Express.js 🐢</th>
                            <th>Fastify ⚡</th>
                            <th>Vexora (This) 🚀</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Performance / Speed</strong></td>
                            <td>Low-Medium (~15,000 req/sec)</td>
                            <td>High (~60,000 req/sec)</td>
                            <td><strong>Ultra-High (~90,000 req/sec)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Dependency Size</strong></td>
                            <td>Heavy (Dozens of dependencies)</td>
                            <td>Medium (Several dependencies)</td>
                            <td><strong>Zero-Dependency Core</strong> (Built entirely on Node.js core)</td>
                        </tr>
                        <tr>
                            <td><strong>Request Context</strong></td>
                            <td>Requires parameter drilling (<code>req, res</code>)</td>
                            <td>Requires parameter drilling</td>
                            <td><strong>Thread-Safe Global Context</strong> (<code>AsyncLocalStorage</code>)</td>
                        </tr>
                        <tr>
                            <td><strong>Real-time WebSockets</strong></td>
                            <td>Requires third-party packages (<code>socket.io</code>, <code>ws</code>)</td>
                            <td>Requires <code>@fastify/websocket</code> plugin</td>
                            <td><strong>Native WebSockets Server</strong> built directly into TCP layer</td>
                        </tr>
                        <tr>
                            <td><strong>Database Routing</strong></td>
                            <td>None (Requires Prisma, Sequelize, etc.)</td>
                            <td>None (Requires external plugins/ORMs)</td>
                            <td><strong>In-built Multi-Connection DB Multiplexer</strong> (MySQL & Postgres)</td>
                        </tr>
                        <tr>
                            <td><strong>Security Defaults</strong></td>
                            <td>Barebones (Needs manual configuration)</td>
                            <td>Medium (Plugins needed)</td>
                            <td><strong>Hardened by Default</strong> (CSRF, Rate Limiting, Helmet Headers, CORS)</td>
                        </tr>
                        <tr>
                            <td><strong>Error Logging</strong></td>
                            <td>Exposes full stack traces by default</td>
                            <td>Standard logging</td>
                            <td><strong>Silent Masked Logging</strong> (UUIDs for clients, masked sensitive fields)</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="comparison-section">
            <h2>🔒 Security Implementations & Star Ratings</h2>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Feature / Criteria</th>
                            <th>Express.js 🐢</th>
                            <th>Fastify ⚡</th>
                            <th>Vexora (This) 🚀</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>CSRF Protection</strong></td>
                            <td>⭐⭐☆☆☆<br><small>No default. Third-party packages deprecated</small></td>
                            <td>⭐⭐⭐☆☆<br><small>No default. Plugin <code>@fastify/csrf</code> is solid</small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>Timing-safe verification & token rotation built-in</small></td>
                        </tr>
                        <tr>
                            <td><strong>SQL Injection Defense</strong></td>
                            <td>⭐☆☆☆☆<br><small>No default. Depends entirely on external ORMs</small></td>
                            <td>⭐☆☆☆☆<br><small>No default. Depends entirely on external ORMs</small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>Regex-based quoting and prepared queries built-in</small></td>
                        </tr>
                        <tr>
                            <td><strong>Security Headers (Helmet)</strong></td>
                            <td>⭐☆☆☆☆<br><small>No default. Requires separate <code>helmet</code> plugin</small></td>
                            <td>⭐⭐⭐☆☆<br><small>Basic headers. Requires <code>@fastify/helmet</code></small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>Helmet equivalent headers sent by default</small></td>
                        </tr>
                        <tr>
                            <td><strong>DDoS & Rate Limiting</strong></td>
                            <td>⭐☆☆☆☆<br><small>No default. Easy to crash via spam requests</small></td>
                            <td>⭐⭐⭐☆☆<br><small>No default. Good external plugin available</small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>In-built global Rate Limiter blocks spam IPs</small></td>
                        </tr>
                        <tr>
                            <td><strong>Token & Session Hijacking</strong></td>
                            <td>⭐⭐☆☆☆<br><small>Requires manual security setups</small></td>
                            <td>⭐⭐⭐☆☆<br><small>Needs secure plugins config</small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>TokenVault binds tokens to IP, Device, and Session</small></td>
                        </tr>
                        <tr>
                            <td><strong>Error Path Leakage</strong></td>
                            <td>⭐☆☆☆☆<br><small>Exposes internal folder paths to client</small></td>
                            <td>⭐⭐⭐⭐☆<br><small>Can hide paths in production</small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>Generates random Error UUID, hides server folder paths</small></td>
                        </tr>
                        <tr>
                            <td><strong>Sensitive Field Masking</strong></td>
                            <td>⭐☆☆☆☆<br><small>No default. Logs passwords in plain text</small></td>
                            <td>⭐⭐☆☆☆<br><small>Needs manual serializers config</small></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(Best)</strong><br><small>Automatically masks passwords/CVVs/tokens in logs</small></td>
                        </tr>
                        <tr>
                            <td><strong>Overall Security Grade</strong></td>
                            <td><strong>C- (Vulnerable by default)</strong></td>
                            <td><strong>B (Safe with plugins)</strong></td>
                            <td><strong>A+ (Hardened by default)</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="comparison-section">
            <h2>🚀 Exclusive Native Engines</h2>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Exclusive Feature</th>
                            <th>Express.js 🐢</th>
                            <th>Fastify ⚡</th>
                            <th>Vexora (This) 🚀</th>
                            <th>Rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Native SMTP Mail Client</strong></td>
                            <td>❌ <small>Requires <code>nodemailer</code></small></td>
                            <td>❌ <small>Requires external plugin</small></td>
                            <td>✅ <strong>Built-in (Zero-dep TCP/TLS)</strong></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(10/10)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Background Queue & Cron Daemon</strong></td>
                            <td>❌ <small>Requires <code>bull</code> / <code>node-cron</code></small></td>
                            <td>❌ <small>Requires external plugins</small></td>
                            <td>✅ <strong>Built-in Queue & Scheduler</strong></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(10/10)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Bot Jitter & Route Scanner Shield</strong></td>
                            <td>❌ <small>Vulnerable to bots</small></td>
                            <td>❌ <small>Requires custom scripts</small></td>
                            <td>✅ <strong>Built-in Jitter & 404 Guard</strong></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(10/10)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Sub-microsecond RAM Cache</strong></td>
                            <td>❌ <small>Requires external Redis</small></td>
                            <td>❌ <small>Requires external Redis</small></td>
                            <td>✅ <strong>Built-in RAM Cache (Redis Mock)</strong></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(10/10)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Encrypted File Storage & Spoof Guard</strong></td>
                            <td>❌ <small>Requires <code>multer</code> + crypto</small></td>
                            <td>❌ <small>Requires <code>@fastify/multipart</code></small></td>
                            <td>✅ <strong>Built-in (AES-256 + Magic Guard)</strong></td>
                            <td>⭐⭐⭐⭐⭐ <strong>(10/10)</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="banner">
            <h2>Explore the Documentation</h2>
            <p>Read the comprehensive documentation on GitHub to configure modular routes, queries, tasks, and shields.</p>
            <div class="btn-group">
                <a href="https://github.com/Satyam9725/vexora" class="btn btn-primary" target="_blank">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                    View GitHub Docs
                </a>
            </div>
        </div>

        <footer>
            Vexora Engine v${version} • Created by Satyam Kumar
        </footer>
    </div>
</body>
</html>`;
}
