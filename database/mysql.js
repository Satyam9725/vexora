"use strict";

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

import mysql from "mysql2/promise";
import { performance } from "node:perf_hooks";

let pool = null;

function buildPoolOptions(input) {
  const defaultOptions = {
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    namedPlaceholders: true,
    connectTimeout: 1000, // Time out after 2 seconds if database is unreachable
  };

  if (typeof input === "object" && input !== null) {
    return {
      ...defaultOptions,
      host: input.host || "localhost",
      user: input.user || input.username || "root",
      password: input.password || input.pass || "",
      database: input.database || input.dbname || "",
      port: parseInt(input.port) || 3306,
    };
  }

  if (typeof input === "string") {
    const str = input.trim();
    
    // Check if it's a URL string
    if (str.startsWith("mysql://")) {
      try {
        const parsed = new URL(str);
        return {
          ...defaultOptions,
          host: parsed.hostname,
          port: parseInt(parsed.port) || 3306,
          user: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
          database: parsed.pathname.replace(/^\//, ""),
        };
      } catch (e) {
        // Fallback for URLs with unencoded special characters in password
        const match = str.match(/^mysql:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.+)$/);
        if (match) {
          return {
            ...defaultOptions,
            user: decodeURIComponent(match[1]),
            password: decodeURIComponent(match[2]),
            host: match[3],
            port: match[4] ? parseInt(match[4]) : 3306,
            database: match[5],
          };
        }
      }
    }

    return {
      ...defaultOptions,
      uri: str,
    };
  }

  return defaultOptions;
}

async function connect(input) {
  if (pool) {
    return pool;
  }

  try {
    const start = performance.now();
    const poolConfig = buildPoolOptions(input);

    pool = mysql.createPool(poolConfig);

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    const end = performance.now();
    console.log(`✅ MySQL Connected (${(end - start).toFixed(2)}ms)`);

    return pool;
  } catch (err) {
    pool = null;
    console.error("❌ MySQL Connection Failed:", err.message);
    throw err;
  }
}

async function disconnect() {
  if (!pool) return;
  await pool.end();
  pool = null;
  console.log("🔌 MySQL Disconnected");
}

async function ping() {
  if (!pool) {
    throw new Error("Database not connected.");
  }
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  return true;
}

async function query(sql, params = []) {
  if (!pool) {
    throw new Error("Database not connected.");
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function execute(sql, params = []) {
  if (!pool) {
    throw new Error("Database not connected.");
  }
  const [result] = await pool.execute(sql, params);
  return result;
}

async function transaction(callback) {
  if (!pool) {
    throw new Error("Database not connected.");
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export default {
  connect,
  disconnect,
  ping,
  query,
  execute,
  transaction,
};
