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



import { Pool } from "pg";
import { performance } from "node:perf_hooks";

let pool = null;

/**
 * Connect PostgreSQL
 */
async function connect(url) {
  if (pool) {
    return pool;
  }

  try {
    const start = performance.now();

    let config = {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false,
    };

    if (typeof url === "string") {
      config.connectionString = url;
    } else if (typeof url === "object" && url !== null) {
      if (url.max !== undefined || url.connectionLimit !== undefined || url.DB_POOL_MAX !== undefined) {
        config.max = parseInt(url.max !== undefined ? url.max : (url.connectionLimit !== undefined ? url.connectionLimit : url.DB_POOL_MAX));
      }
      if (url.idleTimeoutMillis !== undefined || url.idleTimeout !== undefined) {
        config.idleTimeoutMillis = parseInt(url.idleTimeoutMillis !== undefined ? url.idleTimeoutMillis : url.idleTimeout);
      }
      if (url.connectionTimeoutMillis !== undefined || url.connectTimeout !== undefined) {
        config.connectionTimeoutMillis = parseInt(url.connectionTimeoutMillis !== undefined ? url.connectionTimeoutMillis : url.connectTimeout);
      }
      if (url.allowExitOnIdle !== undefined) {
        config.allowExitOnIdle = !!url.allowExitOnIdle;
      }

      if (url.url || url.DB_URL || url.uri) {
        config.connectionString = url.url || url.DB_URL || url.uri;
      } else {
        config.user = url.user || url.username;
        config.host = url.host;
        config.database = url.database || url.dbname;
        config.password = url.password || url.pass;
        config.port = parseInt(url.port) || 5432;
      }
    }

    pool = new Pool(config);

    const client = await pool.connect();

    await client.query("SELECT 1");

    client.release();

    const end = performance.now();

    console.log(`✅ PostgreSQL Connected (${(end - start).toFixed(2)}ms)`);

    return pool;
  } catch (err) {
    pool = null;

    console.error("❌ PostgreSQL Connection Failed");

    throw err;
  }
}

/**
 * Disconnect
 */
async function disconnect() {
  if (!pool) return;

  await pool.end();

  pool = null;

  console.log("🔌 PostgreSQL Disconnected");
}

/**
 * Health Check
 */
async function ping() {
  if (!pool) {
    throw new Error("Database not connected.");
  }

  await pool.query("SELECT 1");

  return true;
}

/**
 * Query
 */
async function query(sql, params = []) {
  if (!pool) {
    throw new Error("Database not connected.");
  }

  const result = await pool.query(sql, params);

  return result.rows;
}

/**
 * Execute
 */
async function execute(sql, params = []) {
  return query(sql, params);
}

/**
 * Transaction
 */
async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (err) {
    await client.query("ROLLBACK");

    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get Pool
 */
function getPool() {
  return pool;
}

export default {
  connect,

  disconnect,

  ping,

  query,

  execute,

  transaction,

  getPool,
};
