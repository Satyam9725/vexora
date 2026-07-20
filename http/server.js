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
      response.status(404).json({
          status: false,
          message: "Route Not Found"
      });
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

      // Global DDoS / Rate Limiting Protection
      if (Config.RATE_LIMIT_ENABLED) {
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
      console.log("🛑 Vexora Server Stopped");
    });

    process.once("SIGINT", () => {
      console.log("\nStopping Vexora...");

      server.close(() => {
        console.log("✅ Server Closed");
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
