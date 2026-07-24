import assert from "node:assert";
import mysqlModule from "mysql2/promise";
import Vexora from "../Vexora.js";
import mysql from "../database/mysql.js";
import mongodb from "../database/mongodb.js";
import BehaviorAnalyzer from "../security/BehaviorAnalyzer.js";

// Mock MySQL Data Store
let mysqlStore = [];
let mysqlLastId = 0;

// Mock MongoDB Data Store
let mongoStore = [];
let mongoLastId = 0;

// Mock MySQL Driver
const origCreatePool = mysqlModule.createPool;
mysqlModule.createPool = (config) => {
  return {
    getConnection: async () => ({
      ping: async () => {},
      release: () => {}
    }),
    query: async (sql, params = []) => {
      const cleanSql = sql.trim().toUpperCase();
      console.log(`   [Mock MySQL Query]: ${sql}`);
      if (cleanSql.startsWith("SELECT")) {
        if (cleanSql.includes("WHERE ID = ?") || cleanSql.includes("WHERE `ID` = ?")) {
          const match = mysqlStore.find(r => r.id == params[0]);
          return [match ? [match] : []];
        }
        if (cleanSql.includes("WHERE STATUS = ?") || cleanSql.includes("WHERE `STATUS` = ?")) {
          const matched = mysqlStore.filter(r => r.status == params[0]);
          return [matched];
        }
        if (cleanSql.includes("WHERE TITLE = ?") || cleanSql.includes("WHERE `TITLE` = ?")) {
          const match = mysqlStore.find(r => r.title == params[0]);
          return [match ? [match] : []];
        }
        return [mysqlStore];
      }
      return [[]];
    },
    execute: async (sql, params = []) => {
      const cleanSql = sql.trim().toUpperCase();
      console.log(`   [Mock MySQL Execute]: ${sql}`);
      if (cleanSql.startsWith("CREATE TABLE")) {
        return [{ affectedRows: 0 }];
      }
      if (cleanSql.startsWith("ALTER TABLE")) {
        return [{ affectedRows: 0 }];
      }
      if (cleanSql.startsWith("DROP TABLE")) {
        return [{ affectedRows: 0 }];
      }
      if (cleanSql.startsWith("INSERT")) {
        mysqlLastId++;
        const record = { id: mysqlLastId, title: params[0], status: params[1] || "active" };
        mysqlStore.push(record);
        return [{ insertId: mysqlLastId, affectedRows: 1 }];
      }
      if (cleanSql.startsWith("UPDATE")) {
        const id = params[1];
        const match = mysqlStore.find(r => r.id == id);
        if (match) {
          match.title = params[0] || match.title;
          if (params.length > 0 && typeof params[0] === "string" && !params[0].includes("User")) {
            match.status = params[0]; // handles status updates
          }
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
      }
      if (cleanSql.startsWith("DELETE")) {
        const id = params[0];
        const initialLen = mysqlStore.length;
        mysqlStore = mysqlStore.filter(r => r.id != id);
        return [{ affectedRows: initialLen - mysqlStore.length }];
      }
      return [{ affectedRows: 0 }];
    },
    end: async () => {}
  };
};

// Mock MongoDB package and Driver
const mockDbInstance = {
  collection: (name) => {
    return {
      insertOne: async (doc) => {
        mongoLastId++;
        const _id = `mongo_id_${mongoLastId}`;
        const record = { _id, id: _id, ...doc };
        mongoStore.push(record);
        return { insertedId: _id };
      },
      find: (filter = {}) => {
        let items = [...mongoStore];
        if (filter._id) {
          items = items.filter(r => r._id == filter._id);
        } else if (filter.title) {
          items = items.filter(r => r.title == filter.title);
        } else if (filter.id) {
          items = items.filter(r => r.id == filter.id);
        } else if (filter.status) {
          items = items.filter(r => r.status == filter.status);
        }
        return {
          toArray: async () => items,
          skip: function(n) { return this; },
          limit: function(n) { return this; },
          sort: function(s) { return this; }
        };
      },
      updateMany: async (filter, update) => {
        let matched = 0;
        let modified = 0;
        const setVal = update.$set || {};
        mongoStore.forEach(r => {
          let matches = true;
          if (filter._id && r._id != filter._id) matches = false;
          if (filter.id && r.id != filter.id) matches = false;
          if (matches) {
            matched++;
            Object.assign(r, setVal);
            modified++;
          }
        });
        return { matchedCount: matched, modifiedCount: modified };
      },
      deleteMany: async (filter) => {
        const initialLen = mongoStore.length;
        if (filter._id) {
          mongoStore = mongoStore.filter(r => r._id != filter._id);
        } else if (filter.id) {
          mongoStore = mongoStore.filter(r => r.id != filter.id);
        } else if (Object.keys(filter).length === 0 || !filter) {
          mongoStore = [];
        }
        return { deletedCount: initialLen - mongoStore.length };
      },
      countDocuments: async (filter) => {
        return mongoStore.length;
      }
    };
  }
};

const mockClientInstance = {
  connect: async () => {},
  db: () => mockDbInstance,
  close: async () => {}
};

// Intercept mongodb package dynamically
import Module from "node:module";
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "mongodb") {
    return { MongoClient: function() { return mockClientInstance; } };
  }
  return origRequire.apply(this, arguments);
};

// Directly mock the connect in mongodb.js
const mongoDriver = (await import("../database/mongodb.js")).default;
mongoDriver.connect = async () => {
  return mockDbInstance;
};
mongoDriver.getDb = () => mockDbInstance;

async function runAllApiRoutesTest() {
  if (BehaviorAnalyzer) BehaviorAnalyzer.isEnabled = false;
  Vexora.config.set("DETECT_BOT_BEHAVIOR", "false");
  Vexora.config.set("SUSPICIOUS_THRESHOLD", "99999");

  console.log("==========================================");
  console.log("🚀 STARTING DYNAMIC RUNNER FOR ALL API ROUTES");
  console.log("==========================================\n");

  console.log("1️⃣ Connecting to Mock MySQL & Mock MongoDB databases...");
  await Vexora.connect({ host: "localhost", driver: "mysql" }, "auth");
  await Vexora.connect({ host: "localhost", driver: "mongodb" }, "mongodb");
  console.log("   ✅ Both databases connected!\n");

  console.log("2️⃣ Starting Vexora Server...");
  const port = 19777;
  const app = Vexora.start(port);
  console.log("   ✅ Server started successfully!\n");

  const baseUrl = `http://localhost:${port}`;

  for (const dbType of ["mysql", "mongo"]) {
    console.log(`\n======================================================`);
    console.log(`   Running All Endpoint Scripts for: [${dbType.toUpperCase()}]`);
    console.log(`======================================================`);

    // 1. Create Table / Collection
    console.log(`👉 POST /api/${dbType}/createTable ...`);
    const createTableRes = await Vexora.http.post(`${baseUrl}/api/${dbType}/createTable`, {
      table: "user",
      columns: { id: "INT PRIMARY KEY", title: "VARCHAR(255)" }
    });
    assert.strictEqual(createTableRes.ok, true);
    console.log(`   ✅ createTable success:`, JSON.stringify(createTableRes.data));

    // 2. Alter Table / Collection (uses PUT method per api.whitelist.js)
    console.log(`👉 PUT /api/${dbType}/alterTable ...`);
    const alterTableRes = await Vexora.http.put(`${baseUrl}/api/${dbType}/alterTable`, {
      table: "user",
      action: "add",
      column: "status",
      type: "VARCHAR(50)"
    });
    if (!alterTableRes.ok) {
      console.error("❌ alterTable failed with response:", JSON.stringify(alterTableRes));
    }
    assert.strictEqual(alterTableRes.ok, true);
    console.log(`   ✅ alterTable success:`, JSON.stringify(alterTableRes.data));

    // 3. Insert Record
    console.log(`👉 POST /api/${dbType}/insert ...`);
    const insertRes = await Vexora.http.post(`${baseUrl}/api/${dbType}/insert`, {
      title: `Live ${dbType.toUpperCase()} User`,
      status: "active"
    });
    assert.strictEqual(insertRes.ok, true);
    const createdId = insertRes.data.data.id;
    console.log(`   ✅ insert success! ID: ${createdId}`);

    // 4. Fetch All Records
    console.log(`👉 GET /api/${dbType}/fetchAll ...`);
    const fetchAllRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetchAll`);
    assert.strictEqual(fetchAllRes.ok, true);
    console.log(`   ✅ fetchAll count: ${fetchAllRes.data.data.length}`);

    // 5. Fetch All Where Records
    console.log(`👉 GET /api/${dbType}/fetchAllWhere ...`);
    const fetchAllWhereRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetchAllWhere`, {
      query: { status: "active" }
    });
    assert.strictEqual(fetchAllWhereRes.ok, true);
    console.log(`   ✅ fetchAllWhere count: ${fetchAllWhereRes.data.data.length}`);

    // 6. Fetch Single Record
    console.log(`👉 GET /api/${dbType}/fetch ...`);
    const fetchRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetch`, {
      query: { id: createdId }
    });
    assert.strictEqual(fetchRes.ok, true);
    console.log(`   ✅ fetch success:`, JSON.stringify(fetchRes.data));

    // 7. Update Record
    console.log(`👉 PUT /api/${dbType}/update ...`);
    const updateRes = await Vexora.http.put(`${baseUrl}/api/${dbType}/update`, {
      id: createdId,
      title: `Updated Live ${dbType.toUpperCase()} User`
    });
    assert.strictEqual(updateRes.ok, true);
    console.log(`   ✅ update success!`);

    // 8. Check Existence (Exists)
    console.log(`👉 GET /api/${dbType}/exists ...`);
    const existsRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/exists`, {
      query: { title: `Updated Live ${dbType.toUpperCase()} User` }
    });
    assert.strictEqual(existsRes.ok, true);
    console.log(`   ✅ exists success:`, JSON.stringify(existsRes.data));

    // 9. Paginate Records
    console.log(`👉 GET /api/${dbType}/paginate ...`);
    const paginateRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/paginate`, {
      query: { page: 1, limit: 10 }
    });
    assert.strictEqual(paginateRes.ok, true);
    console.log(`   ✅ paginate success:`, JSON.stringify(paginateRes.data));

    // 10. Run Batch Script
    console.log(`👉 GET /api/${dbType}/run ...`);
    const runRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/run`);
    assert.strictEqual(runRes.ok, true);
    console.log(`   ✅ run batch success:`, JSON.stringify(runRes.data));

    // 11. Delete Record
    console.log(`👉 DELETE /api/${dbType}/delete ...`);
    const deleteRes = await Vexora.http.delete(`${baseUrl}/api/${dbType}/delete`, {
      body: { id: createdId }
    });
    assert.strictEqual(deleteRes.ok, true);
    console.log(`   ✅ delete success!`);

    // 12. Drop Table / Collection
    console.log(`👉 DELETE /api/${dbType}/dropTable ...`);
    const dropTableRes = await Vexora.http.delete(`${baseUrl}/api/${dbType}/dropTable`, {
      body: { table: "user" }
    });
    assert.strictEqual(dropTableRes.ok, true);
    console.log(`   ✅ dropTable success:`, JSON.stringify(dropTableRes.data));
  }

  // Close server
  console.log("\n4️⃣ Cleaning up and closing server...");
  app.close();
  await mysql.disconnect();
  console.log("   ✅ Done!");

  console.log("\n==========================================");
  console.log("🎉 ALL API ROUTE SCRIPTS VERIFIED SUCCESSFULLY (100%)!");
  console.log("==========================================\n");
}

runAllApiRoutesTest().catch(err => {
  console.error("❌ Live API test failed:", err);
  process.exit(1);
});
