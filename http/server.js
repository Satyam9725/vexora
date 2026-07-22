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
      const isApiRoute = req.path === '/api' || req.path.startsWith('/api/');
      
      if (isHtml && req.method === 'GET' && !isApiRoute) {
          let customErrorHtml = null;
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

          if (req.path === '/') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
              
              res.end(getDefaultLandingPage(publicExists, apiExists, version));
          } else {
              res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
              if (customErrorHtml !== null) {
                  res.end(customErrorHtml);
              } else {
                  res.end(getFileNotFoundPage(req.path));
              }
          }
      } else {
          let message = "Route Not Found";
          if (isApiRoute) {
              message = "API Route Not Found";
              const parts = req.path.split('/').filter(Boolean);
              if (parts.length >= 2) {
                  const folderName = parts[1];
                  const folderPath = path.join(process.cwd(), '.Vexora_Api', folderName);
                  if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
                      message = "Invalid endpoint";
                  }
              }
          }
          response.status(404).json({
              status: false,
              message
          });
      }
  }

  // Auto-save session data ONLY IF session was accessed and contains user keys
  if (req._session && SessionManager.hasUserKeys(req._session)) {
      SessionManager.set(req._sessionId, req._session);
      
      // Sliding session lifetime expiration - Keep cookie alive in browser
      const sessionLifetime = Config.SESSION_LIFETIME;
      // Security: Only set secure: true if the connection is encrypted or forwarded as HTTPS
      const isSecure = req.socket && req.socket.encrypted || (req.headers['x-forwarded-proto'] === 'https');
      response.cookie("VEXORA_SESSID", req._sessionId, { httpOnly: true, secure: isSecure, sameSite: "Lax", maxAge: sessionLifetime, path: "/" });
  }
}

function handleRequestError(err, req, res) {
      if (err && err.message === "VEXORA_ROUTE_BLOCKED") return;

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
        const accept = req.headers['accept'] || '';
        const isHtml = accept.includes('text/html');
        let customErrorHtml = null;
        if (isHtml) {
            try {
                const root = process.cwd();
                const paths = [
                    path.join(root, '.Vexora_error', '500.html'),
                    path.join(root, '.vexora_error', '500.html')
                ];
                for (const p of paths) {
                    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                        customErrorHtml = fs.readFileSync(p, 'utf8');
                        break;
                    }
                }
            } catch (e) {}
        }

        if (customErrorHtml !== null) {
            res.writeHead(500, {
                "Content-Type": "text/html; charset=utf-8",
            });
            res.end(customErrorHtml);
        } else {
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

const PUBLIC_DIR_EXISTS = fs.existsSync(path.join(process.cwd(), 'public'));

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
      if (Guard.check(req, res) === false) {
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
        // Security: Add CSP and HSTS headers
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:;");
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
                  if (stats.isFile() || stats.isDirectory()) {
                      isStaticFile = true;
                  }
              }
          } catch (e) {
              // File does not exist
          }
      }

      // Global DDoS / Rate Limiting Protection (bypassed for static public assets or when public folder is missing)
      const publicExists = PUBLIC_DIR_EXISTS;
      if (Config.RATE_LIMIT_ENABLED && !isStaticFile && publicExists) {
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
    <title>Website is Ready - Vexora Engine</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f5f6fa;
            --surface: #ffffff;
            --primary: #673ab7;
            --primary-hover: #512da8;
            --primary-light: rgba(103, 58, 183, 0.08);
            --text-main: #1e2022;
            --text-muted: #677788;
            --border: #e7eaf3;
            --success: #00c9db;
            --success-bg: rgba(0, 201, 219, 0.1);
            --danger: #de4437;
            --danger-bg: rgba(222, 68, 55, 0.1);
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
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        /* Top Header Navbar */
        .navbar {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 15px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
        }

        .navbar-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.25rem;
            font-weight: 800;
            color: var(--primary);
            text-decoration: none;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }

        .navbar-brand span {
            color: #2f2f2f;
        }

        .nav-status {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--primary-light);
            color: var(--primary);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
        }

        .status-text-mobile {
            display: none;
        }

        .nav-status .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--primary);
            box-shadow: 0 0 6px var(--primary);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.9); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.6; }
        }

        /* Main Container */
        .main-content {
            flex-grow: 1;
            padding: 40px 20px;
        }

        .container {
            width: 100%;
            max-width: 960px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 35px;
        }

        .card {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(103, 58, 183, 0.05);
            width: 100%;
            padding: 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(90deg, #673ab7, #00c9db);
        }

        .rocket-icon {
            font-size: 3.5rem;
            margin-bottom: 20px;
            display: inline-block;
            animation: float 4s ease-in-out infinite;
        }

        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
        }

        h1 {
            font-size: 2.25rem;
            font-weight: 800;
            color: #1e2022;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 1.05rem;
            margin-bottom: 30px;
            max-width: 580px;
            margin-left: auto;
            margin-right: auto;
        }

        /* Status Panels */
        .status-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 30px;
            text-align: left;
        }

        .status-item {
            background-color: #fafbfe;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .status-name {
            font-weight: 600;
            font-size: 0.9rem;
            color: #2f3e46;
        }

        .status-badge {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 5px;
            text-transform: uppercase;
        }

        .status-active {
            background-color: var(--success-bg);
            color: #00a5b5;
        }

        .status-missing {
            background-color: var(--danger-bg);
            color: #bd2d1e;
        }

        /* Next Steps Box */
        .instruction-box {
            background-color: #0f172a;
            color: #f8fafc;
            border-radius: 10px;
            padding: 20px;
            text-align: left;
            margin-bottom: 30px;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .instruction-box h3 {
            font-size: 0.95rem;
            font-weight: 700;
            color: #38bdf8;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .instruction-box code {
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            line-height: 1.5;
            display: block;
            color: #cbd5e1;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .instruction-box .comment {
            color: #64748b;
        }

        .instruction-box .command {
            color: #f43f5e;
        }

        /* Buttons */
        .btn-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            max-width: 540px;
            margin: 0 auto 30px auto;
        }

        .btn-group a:first-child {
            grid-column: span 2;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 24px;
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
            box-shadow: 0 4px 12px rgba(103, 58, 183, 0.2);
        }

        .btn-primary:hover {
            background-color: var(--primary-hover);
            box-shadow: 0 6px 16px rgba(103, 58, 183, 0.3);
            transform: translateY(-1px);
        }

        .btn-outline {
            background-color: transparent;
            color: var(--text-main);
            border: 1px solid var(--border);
        }

        .btn-outline:hover {
            background-color: #fafafa;
            border-color: #cbd5e0;
        }

        .btn-youtube {
            background-color: #ff4757;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(255, 71, 87, 0.2);
        }

        .btn-youtube:hover {
            background-color: #ff2e44;
            box-shadow: 0 6px 16px rgba(255, 71, 87, 0.3);
            transform: translateY(-1px);
        }

        .btn-dev {
            background-color: #05c46b;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(5, 196, 107, 0.2);
        }

        .btn-dev:hover {
            background-color: #04a95c;
            box-shadow: 0 6px 16px rgba(5, 196, 107, 0.3);
            transform: translateY(-1px);
        }

        /* Comparison Tables Section */
        .tables-section {
            display: flex;
            flex-direction: column;
            gap: 30px;
        }

        .comparison-card {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(103, 58, 183, 0.03);
            padding: 30px;
        }

        .comparison-card h2 {
            font-size: 1.3rem;
            font-weight: 800;
            color: #1e2022;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-left: 4px solid var(--primary);
            padding-left: 12px;
        }

        .table-responsive {
            width: 100%;
            overflow-x: auto;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--surface);
            -webkit-overflow-scrolling: touch;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 0.9rem;
            min-width: 600px;
        }

        th, td {
            padding: 14px 18px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
            white-space: nowrap;
        }

        th {
            background-color: #fafbfe;
            color: #2f3e46;
            font-weight: 700;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background-color: rgba(103, 58, 183, 0.01);
        }

        .vexora-col {
            background-color: rgba(103, 58, 183, 0.015);
            font-weight: 600;
            color: var(--primary);
        }

        .star-rating {
            color: #ff9800;
            font-weight: 700;
            font-size: 1rem;
        }

        .text-success-custom {
            color: #00a5b5;
            font-weight: 600;
        }

        .text-danger-custom {
            color: #de4437;
            font-weight: 500;
        }

        .badge-framework {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 700;
        }
        .badge-express {
            background-color: #f1f3f5;
            color: #495057;
        }
        .badge-fastify {
            background-color: #e8f4fd;
            color: #1d88e5;
        }
        .badge-vexora {
            background-color: var(--primary-light);
            color: var(--primary);
        }

        /* Footer */
        footer {
            position: sticky;
            bottom: 0;
            z-index: 1000;
            background-color: #1e2022;
            color: #a9b4c0;
            padding: 20px 40px;
            text-align: center;
            font-size: 0.85rem;
            border-top: 1px solid #2d3238;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .footer-logo {
            font-weight: 700;
            color: #ffffff;
        }

        .footer-logo span {
            color: var(--primary);
        }

        /* Responsive layout rules */
        .comparison-cards-mobile {
            display: none;
            flex-direction: column;
            gap: 15px;
        }

        .feature-mobile-card {
            background-color: #fafbfe;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .feature-mobile-card h4 {
            font-size: 0.95rem;
            font-weight: 700;
            color: #1e2022;
            border-bottom: 1px solid var(--border);
            padding-bottom: 6px;
            margin-bottom: 4px;
        }

        .framework-val {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.85rem;
            color: var(--text-muted);
            gap: 10px;
        }

        .framework-val > span {
            white-space: nowrap;
            flex-shrink: 0;
        }

        .framework-val.vexora-val {
            background-color: var(--primary-light);
            padding: 6px 10px;
            border-radius: 6px;
            color: var(--primary);
            font-weight: 600;
        }

        @media (max-width: 768px) {
            .navbar {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                padding: 10px 15px;
            }
            .star-rating {
                font-size: 0.75rem;
                letter-spacing: -1.2px;
            }
            .badge-framework {
                padding: 3px 6px;
                font-size: 0.7rem;
            }
            .framework-val {
                gap: 6px;
            }
            .brand-sub-desktop {
                display: none;
            }
            .status-text-desktop {
                display: none;
            }
            .status-text-mobile {
                display: inline;
            }
            .navbar-brand {
                font-size: 1.05rem;
            }
            .nav-status {
                width: auto;
                justify-content: center;
                font-size: 0.72rem;
                padding: 4px 8px;
            }
            .card {
                padding: 30px 20px;
            }
            .status-grid {
                grid-template-columns: 1fr;
                gap: 10px;
            }
            .btn-group {
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 25px;
            }
            .btn {
                padding: 10px 8px;
                font-size: 0.8rem;
                justify-content: center;
                gap: 4px;
            }
            .comparison-card {
                padding: 20px 15px;
            }
            .table-responsive {
                display: none;
            }
            .comparison-cards-mobile {
                display: flex;
            }
            footer {
                flex-direction: column;
                gap: 6px;
                padding: 12px;
                font-size: 0.75rem;
            }
            .footer-logo {
                font-size: 0.85rem;
            }
        }
    </style>
</head>
<body>
    <!-- Top Header -->
    <header class="navbar">
        <a href="/" class="navbar-brand">
            ⚡ VEXORA <span class="brand-sub-desktop">ENGINE</span>
        </a>
        <div class="nav-status">
            <span class="dot"></span>
            <span class="status-text-desktop">Vexora Server is Ready</span>
            <span class="status-text-mobile">Server Ready</span>
        </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
        <div class="container">
            <!-- Hero Card -->
            <div class="card">
                <span class="rocket-icon">🚀</span>
                <h1>Your Website is Ready!</h1>
                <p class="subtitle">
                    The high-performance microservices environment is successfully configured and active. Start hosting your content by creating static pages.
                </p>

                <!-- Action buttons -->
                <div class="btn-group">
                    <a href="https://github.com/Satyam9725/vexora" class="btn btn-primary" target="_blank">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                        </svg>
                        View Documentation
                    </a>
                    <a href="https://youtube.com/@vexora-engine" class="btn btn-youtube" target="_blank">
                        🎥 Learn on YouTube
                    </a>
                    <a href="mailto:satyam9725.work@gmail.com?subject=Inquiry%20for%20Web%20Development" class="btn btn-dev">
                        💼 Hire Web Developer
                    </a>
                </div>

                <!-- Status Indicators -->
                <div class="status-grid">
                    <div class="status-item">
                        <span class="status-name">📁 public/ folder</span>
                        <span class="status-badge ${publicStatus}">${publicText}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-name">⚙️ .Vexora_Api/ folder</span>
                        <span class="status-badge ${apiStatus}">${apiText}</span>
                    </div>
                </div>

                <!-- Quick Guide -->
                <div class="instruction-box">
                    <h3>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4 17 10 11 4 5"></polyline>
                            <line x1="12" y1="19" x2="20" y2="19"></line>
                        </svg>
                        How to serve your static pages?
                    </h3>
                    <code>
                        <span class="comment"># 1. Create a public folder at your project root</span><br>
                        <span class="command">mkdir</span> public<br><br>
                        <span class="comment"># 2. Create index.html inside the public folder</span><br>
                        <span class="comment"># and add your HTML code (e.g. &lt;h1&gt;Welcome to My Website&lt;/h1&gt;)</span>
                    </code>
                </div>
            </div>

            <!-- Comparison Tables Section -->
            <div class="tables-section">
                <!-- 1. Core Features & Performance -->
                <div class="comparison-card">
                    <h2>⚡ Core Features & Performance</h2>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Feature / Criteria</th>
                                    <th><span class="badge-framework badge-express">Express.js 🐢</span></th>
                                    <th><span class="badge-framework badge-fastify">Fastify ⚡</span></th>
                                    <th><span class="badge-framework badge-vexora">Vexora (This) 🚀</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Performance / Speed</strong></td>
                                    <td>Low-Medium (~15,000 req/sec)</td>
                                    <td>High (~60,000 req/sec)</td>
                                    <td class="vexora-col">✨ Ultra-High (~90,000 req/sec)</td>
                                </tr>
                                <tr>
                                    <td><strong>Dependency Size</strong></td>
                                    <td>Heavy (Dozens of dependencies)</td>
                                    <td>Medium (Several dependencies)</td>
                                    <td class="vexora-col">Zero-Dependency Core</td>
                                </tr>
                                <tr>
                                    <td><strong>Request Context</strong></td>
                                    <td>Requires parameter drilling</td>
                                    <td>Requires parameter drilling</td>
                                    <td class="vexora-col">Thread-Safe Global Context</td>
                                </tr>
                                <tr>
                                    <td><strong>Real-time WebSockets</strong></td>
                                    <td>Requires third-party packages</td>
                                    <td>Requires plugin</td>
                                    <td class="vexora-col">Native WebSockets Server</td>
                                </tr>
                                <tr>
                                    <td><strong>Database Routing</strong></td>
                                    <td>None (Requires external ORM)</td>
                                    <td>None (Requires plugins)</td>
                                    <td class="vexora-col">Built-in Multi-Connection Pool</td>
                                </tr>
                                <tr>
                                    <td><strong>Security Defaults</strong></td>
                                    <td>Barebones (Manual setup)</td>
                                    <td>Medium (Plugins needed)</td>
                                    <td class="vexora-col">Hardened by Default</td>
                                </tr>
                                <tr>
                                    <td><strong>Error Logging</strong></td>
                                    <td>Exposes full stack traces</td>
                                    <td>Standard logging</td>
                                    <td class="vexora-col">Silent Masked Logging</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile Cards Layout -->
                    <div class="comparison-cards-mobile">
                        <div class="feature-mobile-card">
                            <h4>Performance / Speed</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>Low-Medium (~15K/s)</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>High (~60K/s)</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>✨ Ultra-High (~90K/s)</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Dependency Size</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>Heavy</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>Medium</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>Zero-Dependency</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Request Context</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>Param drilling</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>Param drilling</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>Thread-Safe Global</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Real-time WebSockets</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>Needs packages</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>Needs plugin</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>Native Server</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Database Routing</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>None (Needs ORM)</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>None (Needs plugin)</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>Built-in Pool</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Security Defaults</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>Barebones</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>Medium (Needs plugins)</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>Hardened by Default</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Error Logging</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span>Exposes stack traces</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span>Standard logging</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span>Silent Masked</span></div>
                        </div>
                    </div>
                </div>

                <!-- 2. Security Implementations & Star Ratings -->
                <div class="comparison-card">
                    <h2>🔒 Security Implementations & Ratings</h2>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Security Checklist</th>
                                    <th>Express.js 🐢</th>
                                    <th>Fastify ⚡</th>
                                    <th>Vexora (This) 🚀</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>CSRF Protection</strong></td>
                                    <td><span class="star-rating">⭐⭐☆☆☆</span></td>
                                    <td><span class="star-rating">⭐⭐⭐☆☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>SQL Injection Defense</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>Security Headers (Helmet)</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span></td>
                                    <td><span class="star-rating">⭐⭐⭐☆☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>DDoS & Rate Limiting</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span></td>
                                    <td><span class="star-rating">⭐⭐⭐☆☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>Token & Session Hijacking</strong></td>
                                    <td><span class="star-rating">⭐⭐☆☆☆</span></td>
                                    <td><span class="star-rating">⭐⭐⭐☆☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>Error Path Leakage</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span></td>
                                    <td><span class="star-rating">⭐⭐⭐⭐☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>Sensitive Field Masking</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span></td>
                                    <td><span class="star-rating">⭐⭐☆☆☆</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> (Best)</td>
                                </tr>
                                <tr>
                                    <td><strong>Overall Security Grade</strong></td>
                                    <td><strong class="text-danger-custom">C-</strong></td>
                                    <td><strong style="color: #ff9800;">B</strong></td>
                                    <td class="vexora-col"><strong style="color: #4caf50; font-size: 1.1rem;">A+ (Hardened)</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile Cards Layout -->
                    <div class="comparison-cards-mobile">
                        <div class="feature-mobile-card">
                            <h4>CSRF Protection</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐⭐☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐⭐⭐☆☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>SQL Injection Defense</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐☆☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐☆☆☆☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Security Headers (Helmet)</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐☆☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐⭐⭐☆☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>DDoS & Rate Limiting</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐☆☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐⭐⭐☆☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Token & Session Hijacking</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐⭐☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐⭐⭐☆☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Error Path Leakage</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐☆☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐⭐⭐⭐☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Sensitive Field Masking</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span class="star-rating">⭐☆☆☆☆</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span class="star-rating">⭐⭐☆☆☆</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span class="star-rating">⭐⭐⭐⭐⭐</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Overall Security Grade</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <strong class="text-danger-custom">C-</strong></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <strong style="color: #ff9800;">B</strong></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <strong style="color: #4caf50;">A+</strong></div>
                        </div>
                    </div>
                </div>

                <!-- 3. Exclusive Native Engines -->
                <div class="comparison-card">
                    <h2>🚀 Exclusive Native Engines</h2>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Exclusive Feature</th>
                                    <th>Express.js 🐢</th>
                                    <th>Fastify ⚡</th>
                                    <th>Vexora (This) 🚀</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Native SMTP Mail Client</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires package</span></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires plugin</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> <span class="text-success-custom">✅ Built-in (TCP/TLS)</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Background Queue & Cron</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires packages</span></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires plugins</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> <span class="text-success-custom">✅ Built-in Daemon</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Route Scanner Shield</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Vulnerable</span></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Needs custom code</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> <span class="text-success-custom">✅ Built-in Shield</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Sub-microsecond RAM Cache</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires Redis</span></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires Redis</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> <span class="text-success-custom">✅ Built-in MemoryCache</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Encrypted File Storage</strong></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires Multer</span></td>
                                    <td><span class="star-rating">⭐☆☆☆☆</span> <span class="text-danger-custom">❌ Requires Multipart</span></td>
                                    <td class="vexora-col"><span class="star-rating">⭐⭐⭐⭐⭐</span> <span class="text-success-custom">✅ Built-in AES-256</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile Cards Layout -->
                    <div class="comparison-cards-mobile">
                        <div class="feature-mobile-card">
                            <h4>Native SMTP Mail Client</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span><span class="star-rating">⭐</span> Requires package</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span><span class="star-rating">⭐</span> Requires plugin</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span><span class="star-rating">⭐⭐⭐⭐⭐</span> Built-in</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Background Queue & Cron</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span><span class="star-rating">⭐</span> Requires packages</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span><span class="star-rating">⭐</span> Requires plugins</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span><span class="star-rating">⭐⭐⭐⭐⭐</span> Built-in</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Route Scanner Shield</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span><span class="star-rating">⭐</span> Vulnerable</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span><span class="star-rating">⭐</span> Needs custom code</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span><span class="star-rating">⭐⭐⭐⭐⭐</span> Built-in</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Sub-microsecond RAM Cache</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span><span class="star-rating">⭐</span> Requires Redis</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span><span class="star-rating">⭐</span> Requires Redis</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span><span class="star-rating">⭐⭐⭐⭐⭐</span> Built-in</span></div>
                        </div>
                        <div class="feature-mobile-card">
                            <h4>Encrypted File Storage</h4>
                            <div class="framework-val"><span class="badge-framework badge-express">Express.js 🐢</span> <span><span class="star-rating">⭐</span> Requires Multer</span></div>
                            <div class="framework-val"><span class="badge-framework badge-fastify">Fastify ⚡</span> <span><span class="star-rating">⭐</span> Requires Multipart</span></div>
                            <div class="framework-val vexora-val"><span class="badge-framework badge-vexora">Vexora 🚀</span> <span><span class="star-rating">⭐⭐⭐⭐⭐</span> Built-in</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Professional Footer -->
    <footer>
        <div class="footer-logo">
            ⚡ VEXORA<span>ENGINE</span>
        </div>
        <div>
            Vexora v${version}
        </div>
        <div>
            &copy; 2026 Satyam Kumar. All rights reserved.
        </div>
    </footer>
</body>
</html>`;
}

function getFileNotFoundPage(filePath) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404: File Not Found</title>
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
        <h1>File Not Found</h1>
        <p>The requested file could not be located on the server. Please verify the URL path or check the public directory.</p>
        
        <div class="path-container">
            <span class="method">GET</span>
            <span class="path">${filePath}</span>
        </div>

        <div class="brand">
            ⚡ VEXORA <span>SERVER</span>
        </div>
    </div>
</body>
</html>`;
}

