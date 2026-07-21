"use strict";

/**
 * ==========================================================
 * Vexora Framework - HTTP Response Prototype Extension
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
import { performance } from "node:perf_hooks";
import Config from "../core/config.js";

// Extend native ServerResponse prototype to prevent wrapper allocations on every request
Object.assign(http.ServerResponse.prototype, {
  status(code) {
    this.statusCode = code;
    return this;
  },

  header(name, value) {
    this.setHeader(name, value);
    return this;
  },

  headers(headers = {}) {
    if (!headers || typeof headers !== "object") {
      return this;
    }
    for (const key of Object.keys(headers)) {
      this.setHeader(key, headers[key]);
    }
    return this;
  },

  cookie(name, value, options = {}) {
    let cookieString = `${name}=${encodeURIComponent(value)}`;
    if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
    if (options.path) cookieString += `; Path=${options.path}`;
    else cookieString += `; Path=/`;
    // Security: Default httpOnly to true unless explicitly set to false
    if (options.httpOnly !== false) cookieString += `; HttpOnly`;
    if (options.secure) cookieString += `; Secure`;
    if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
    
    const existing = this.getHeader("Set-Cookie");
    if (existing) {
      if (Array.isArray(existing)) {
        this.setHeader("Set-Cookie", [...existing, cookieString]);
      } else {
        this.setHeader("Set-Cookie", [existing, cookieString]);
      }
    } else {
      this.setHeader("Set-Cookie", cookieString);
    }
    
    return this;
  },

  setContentType(type) {
    this.setHeader("Content-Type", type);
    return this;
  },

  text(data) {
    this.setContentType("text/plain; charset=utf-8");
    this.end(String(data ?? ""));
    return this;
  },

  html(data) {
    this.setContentType("text/html; charset=utf-8");
    this.end(String(data ?? ""));
    return this;
  },

  json(data) {
    this.setContentType("application/json; charset=utf-8");
    
    // Automatically inject response latency execution time on all JSON payloads
    if (Config.boolean("SHOW_EXECUTION_TIME", false)) {
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (this.res && this.res.req && this.res.req.startTime && data.execution_time === undefined) {
          data.execution_time = `${(performance.now() - this.res.req.startTime).toFixed(2)}ms`;
        } else if (this.req && this.req.startTime && data.execution_time === undefined) {
          data.execution_time = `${(performance.now() - this.req.startTime).toFixed(2)}ms`;
        }
      }
    }

    if (typeof data === "string") {
      this.end(data);
    } else {
      this.end(JSON.stringify(data));
    }
    return this;
  },

  send(data) {
    if (Buffer.isBuffer(data)) {
      this.setContentType("application/octet-stream");
      this.end(data);
      return this;
    }

    if (typeof data === "object" && data !== null) {
      return this.json(data);
    }

    return this.text(data);
  },

  redirect(url, status = 302) {
    this.writeHead(status, {
      Location: String(url),
      "Content-Type": "text/plain; charset=utf-8",
    });
    this.end(`Redirecting to ${url}`);
    return this;
  },

  download(fileName, buffer) {
    if (!fileName) {
      throw new Error("fileName is required");
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new Error("buffer must be a Buffer");
    }

    this.writeHead(200, {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/octet-stream",
      "Content-Length": buffer.length,
    });

    this.end(buffer);
    return this;
  },

  noContent() {
    this.statusCode = 204;
    this.end();
    return this;
  },

  created(data = {}) {
    return this.status(201).json(data);
  },

  badRequest(message = "Bad Request") {
    return this.status(400).json({
      success: false,
      message,
    });
  },

  unauthorized(message = "Unauthorized") {
    return this.status(401).json({
      success: false,
      message,
    });
  },

  forbidden(message = "Forbidden") {
    return this.status(403).json({
      success: false,
      message,
    });
  },

  notFound(message = "Not Found") {
    return this.status(404).json({
      success: false,
      message,
    });
  },

  error(message = "Error", statusCode = 400, data = null) {
    let executionTime = undefined;
    if (Config.boolean("SHOW_EXECUTION_TIME", false)) {
      if (this.req && this.req.startTime) {
        executionTime = `${(performance.now() - this.req.startTime).toFixed(2)}ms`;
      }
    }
    return this.status(statusCode).json({
      status: false,
      message: message,
      data: data,
      execution_time: executionTime
    });
  },

  success(data = null, message = "Success") {
    let executionTime = undefined;
    if (Config.boolean("SHOW_EXECUTION_TIME", false)) {
      if (this.req && this.req.startTime) {
        executionTime = `${(performance.now() - this.req.startTime).toFixed(2)}ms`;
      }
    }
    return this.json({
      status: true,
      message: message,
      data: data,
      execution_time: executionTime
    });
  }
});

class Response {
  constructor(res) {
    return res; // transparently return native res which has everything
  }
}

export default Response;
