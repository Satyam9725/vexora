"use strict";

/**
 * ==========================================================
 * Vexora Framework - Native SQLite Driver Connector
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

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

let dbInstance = null;

/**
 * Connect SQLite Database
 */
async function connect(connectionInput) {
  if (dbInstance) {
    return dbInstance;
  }

  let dbPath = ":memory:";
  if (typeof connectionInput === "string") {
    dbPath = connectionInput;
  } else if (typeof connectionInput === "object" && connectionInput !== null) {
    dbPath = connectionInput.filepath || connectionInput.DB_FILE || connectionInput.database || connectionInput.DB_NAME || ":memory:";
  }

  if (dbPath !== ":memory:" && !path.isAbsolute(dbPath)) {
    dbPath = path.join(process.cwd(), dbPath);
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  try {
    const start = performance.now();
    let sqliteModule = null;

    try {
      // Try native Node.js sqlite module first
      sqliteModule = await import("node:sqlite");
      const { DatabaseSync } = sqliteModule;
      dbInstance = new DatabaseSync(dbPath);
    } catch {
      try {
        const betterSqlite = await import("better-sqlite3");
        const BetterSqlite = betterSqlite.default || betterSqlite;
        dbInstance = new BetterSqlite(dbPath);
      } catch (err) {
        throw new Error("SQLite driver missing. Native 'node:sqlite' or 'better-sqlite3' package required.");
      }
    }

    const end = performance.now();
    console.log(`✅ SQLite Connected (${(end - start).toFixed(2)}ms) [${dbPath}]`);
    return dbInstance;
  } catch (err) {
    dbInstance = null;
    console.error("❌ SQLite Connection Failed:", err.message);
    throw err;
  }
}

/**
 * Disconnect SQLite
 */
async function disconnect() {
  if (!dbInstance) return;
  try {
    if (typeof dbInstance.close === "function") {
      dbInstance.close();
    }
  } catch {}
  dbInstance = null;
  console.log("🔌 SQLite Disconnected");
}

/**
 * Health Check / Ping
 */
async function ping() {
  if (!dbInstance) {
    throw new Error("SQLite not connected.");
  }
  return true;
}

/**
 * Query / Execute
 */
async function query(sql, params = []) {
  if (!dbInstance) {
    throw new Error("SQLite not connected.");
  }
  if (typeof dbInstance.prepare === "function") {
    const stmt = dbInstance.prepare(sql);
    if (sql.trim().toUpperCase().startsWith("SELECT") || sql.trim().toUpperCase().startsWith("PRAGMA")) {
      return stmt.all(...params);
    }
    return stmt.run(...params);
  }
  return [];
}

/**
 * Execute DDL
 */
async function execute(sql, params = []) {
  return query(sql, params);
}

/**
 * Get active DB instance
 */
function getDb() {
  return dbInstance;
}

export default {
  connect,
  disconnect,
  ping,
  query,
  execute,
  getDb,
};
