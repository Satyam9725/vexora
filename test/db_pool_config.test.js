import assert from "node:assert";
import mysql from "../database/mysql.js";
import postgres from "../database/postgres.js";
import pg from "pg";

async function testDbPoolConfig() {
  console.log("==========================================");
  console.log("🚀 TESTING DATABASE CONNECTION POOL CONFIG");
  console.log("==========================================\n");

  console.log("1️⃣ Testing MySQL custom pool config...");
  const mysqlModule = await import("mysql2/promise");
  const origCreatePool = mysqlModule.default.createPool;
  
  let passedMysqlOptions = null;
  mysqlModule.default.createPool = (config) => {
    passedMysqlOptions = config;
    return {
      getConnection: async () => ({
        ping: async () => {},
        release: () => {}
      }),
      end: async () => {}
    };
  };

  try {
    await mysql.connect({
      host: "localhost",
      driver: "mysql",
      connectionLimit: 45,
      waitForConnections: false,
      queueLimit: 12
    });

    assert.strictEqual(passedMysqlOptions.connectionLimit, 45, "MySQL connectionLimit should be 45");
    assert.strictEqual(passedMysqlOptions.waitForConnections, false, "MySQL waitForConnections should be false");
    assert.strictEqual(passedMysqlOptions.queueLimit, 12, "MySQL queueLimit should be 12");
    console.log("   ✅ MySQL custom pool config successfully applied!");
  } finally {
    mysqlModule.default.createPool = origCreatePool;
    await mysql.disconnect();
  }

  console.log("2️⃣ Testing PostgreSQL custom pool config...");
  const origPgPoolConnect = pg.Pool.prototype.connect;

  let passedPgConfig = null;
  pg.Pool.prototype.connect = async function() {
    passedPgConfig = this.options; // pg Pool stores its options here
    return {
      query: async () => {},
      release: () => {}
    };
  };

  try {
    await postgres.connect({
      host: "localhost",
      driver: "postgres",
      max: 35,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true
    });

    assert.strictEqual(passedPgConfig.max, 35, "PG max pool size should be 35");
    assert.strictEqual(passedPgConfig.idleTimeoutMillis, 15000, "PG idleTimeoutMillis should be 15000");
    assert.strictEqual(passedPgConfig.connectionTimeoutMillis, 5000, "PG connectionTimeoutMillis should be 5000");
    assert.strictEqual(passedPgConfig.allowExitOnIdle, true, "PG allowExitOnIdle should be true");
    console.log("   ✅ PostgreSQL custom pool config successfully applied!");
  } finally {
    pg.Pool.prototype.connect = origPgPoolConnect;
    await postgres.disconnect();
  }

  console.log("==========================================");
  console.log("🎉 DATABASE CONNECTION POOL CONFIG TEST PASSED 100%!");
  console.log("==========================================\n");
}

testDbPoolConfig();
