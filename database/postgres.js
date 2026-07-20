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

    pool = new Pool({
      connectionString: url,

      max: 20,

      idleTimeoutMillis: 30000,

      connectionTimeoutMillis: 10000,

      allowExitOnIdle: false,
    });

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
