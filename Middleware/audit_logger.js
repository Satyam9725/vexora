/**
 * ==========================================================
 * Vexora Framework
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
import { fileURLToPath } from "url";
import crypto from "crypto";
import { requestContext } from "../core/Context.js";
import Config from "../core/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(process.cwd(), ".Vexora");

function ensure(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mask(data) {
  if (!data || typeof data !== "object") return data;

  const sensitive = [
    "password",
    "token",
    "secret",
    "otp",
    "pin",
    "cvv",
    "key",
    "authorization",
    "cookie",
  ];

  const result = {};

  for (const key in data) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      result[key] = "********";
    } else {
      result[key] = mask(data[key]);
    }
  }

  return result;
}

export function log(level, code, message, extra = {}) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;
  const error_id = `${crypto.randomUUID()}::${dateStr}`;

  let requestMetadata = null;
  try {
    const store = requestContext.getStore();
    if (store && store.req) {
      const req = store.req;
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost';
      const fullUrl = `${protocol}://${host}${req.url}`;
      
      let ip = req.socket?.remoteAddress || '0.0.0.0';
      if (req.headers['cf-connecting-ip']) {
        ip = req.headers['cf-connecting-ip'];
      } else if (req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].split(',')[0].trim();
      }

      requestMetadata = {
        url: fullUrl,
        method: req.method,
        ip: ip,
        userAgent: req.headers['user-agent'] || 'Unknown',
        sessionId: store.sessionId || null,
        query: mask(req.query || {}),
        body: mask(req.body || {})
      };
    }
  } catch {}

  const logItem = {
    error_id,
    level,
    code,
    message,
    time: new Date().toISOString(),
    memory: process.memoryUsage(),
    request: requestMetadata,
    data: mask(extra),
  };

  // If configured for cloud stdout channel, print single-line JSON and exit
  if (Config.get("LOG_CHANNEL") === "stdout") {
    console.log(JSON.stringify(logItem));
    return error_id;
  }

  let category = "System";
  switch (code) {
    case "DB_EXCEPTION":
      category = "Database";
      break;
    case "RUNTIME_ERROR":
      category = "Runtime";
      break;
    case "EXCEPTION":
      category = "Exception";
      break;
    case "FATAL_ERROR":
      category = "Fatal";
      break;
  }

  const dir = path.join(ROOT, "logs", category);

  try {
    ensure(dir);
  } catch (err) {
    console.warn(`⚠️ Warning: Failed to create log directory: ${err.message}`);
  }

  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.json`);
  let logs = [];

  try {
    if (fs.existsSync(file)) {
      logs = JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {}

  logs.push(logItem);

  try {
    fs.writeFileSync(file, JSON.stringify(logs, null, 4));
  } catch (err) {
    console.error(`❌ Failed to write runtime logs to disk: ${err.message}`);
    console.log(`[${level}] ${code}: ${message}`, extra);
  }
  
  return error_id;
}
