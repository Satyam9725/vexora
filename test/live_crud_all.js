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
      if (cleanSql.startsWith("SELECT")) {
        if (cleanSql.includes("WHERE ID = ?") || cleanSql.includes("WHERE `ID` = ?")) {
          const match = mysqlStore.find(r => r.id === params[0]);
          return [match ? [match] : []];
        }
        if (cleanSql.includes("WHERE TITLE = ?") || cleanSql.includes("WHERE `TITLE` = ?")) {
          const match = mysqlStore.find(r => r.title === params[0]);
          return [match ? [match] : []];
        }
        return [mysqlStore];
      }
      return [[]];
    },
    execute: async (sql, params = []) => {
      const cleanSql = sql.trim().toUpperCase();
      if (cleanSql.startsWith("INSERT")) {
        mysqlLastId++;
        const record = { id: mysqlLastId, title: params[0], status: params[1] || "active" };
        mysqlStore.push(record);
        return [{ insertId: mysqlLastId, affectedRows: 1 }];
      }
      if (cleanSql.startsWith("UPDATE")) {
        const id = params[1];
        const match = mysqlStore.find(r => r.id === id);
        if (match) {
          match.title = params[0];
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
      }
      if (cleanSql.startsWith("DELETE")) {
        const id = params[0];
        const initialLen = mysqlStore.length;
        mysqlStore = mysqlStore.filter(r => r.id !== id);
        return [{ affectedRows: initialLen - mysqlStore.length }];
      }
      return [{}];
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
          items = items.filter(r => r._id === filter._id);
        } else if (filter.title) {
          items = items.filter(r => r.title === filter.title);
        } else if (filter.id) {
          items = items.filter(r => r.id === filter.id);
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
          if (filter._id && r._id !== filter._id) matches = false;
          if (filter.id && r.id !== filter.id) matches = false;
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
          mongoStore = mongoStore.filter(r => r._id !== filter._id);
        } else if (filter.id) {
          mongoStore = mongoStore.filter(r => r.id !== filter.id);
        } else if (Object.keys(filter).length === 0) {
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

async function runLiveCrudAllTest() {
  // Disable security block rules for local rapid API request verification
  if (BehaviorAnalyzer) BehaviorAnalyzer.isEnabled = false;
  Vexora.config.set("DETECT_BOT_BEHAVIOR", "false");
  Vexora.config.set("SUSPICIOUS_THRESHOLD", "99999");

  console.log("==========================================");
  console.log("🚀 STARTING LIVE FULL CRUD API VERIFICATION");
  console.log("==========================================\n");

  console.log("1️⃣ Connecting to Mock MySQL & Mock MongoDB databases...");
  await Vexora.connect({ host: "localhost", driver: "mysql" }, "auth");
  await Vexora.connect({ host: "localhost", driver: "mongodb" }, "mongodb");
  console.log("   ✅ Both databases connected!\n");

  console.log("2️⃣ Starting Vexora Server...");
  const port = 19666;
  const app = Vexora.start(port);
  console.log("   ✅ Server started successfully!\n");

  // Mount API paths manually to simulate full routing flow
  for (const dbType of ["mysql", "mongo"]) {
    const targetDb = dbType === "mysql" ? "auth" : "mongodb";

    // POST /api/:db/insert
    app.Vexora("POST", `/api/${dbType}/insert`, async (req, res) => {
      try {
        const { title, status } = req.body || {};
        const insertId = await Vexora.insert(targetDb, "user", { title, status: status || "active" });
        return res.success({ id: insertId }, "Record created successfully");
      } catch (err) {
        return res.error(err.message, 500);
      }
    });

    // GET /api/:db/fetchAll
    app.Vexora("GET", `/api/${dbType}/fetchAll`, async (req, res) => {
      try {
        const list = await Vexora.fetchAll(targetDb, "SELECT * FROM user");
        return res.success(list, "Records fetched successfully");
      } catch (err) {
        return res.error(err.message, 500);
      }
    });

    // GET /api/:db/fetch
    app.Vexora("GET", `/api/${dbType}/fetch`, async (req, res) => {
      try {
        const idVal = req.query?.id;
        const id = dbType === "mysql" ? parseInt(idVal, 10) : idVal;
        const item = await Vexora.fetch(targetDb, "SELECT * FROM user WHERE id = ?", [id]);
        if (!item) return res.error("Record not found", 404);
        return res.success(item, "Record found");
      } catch (err) {
        return res.error(err.message, 500);
      }
    });

    // PUT /api/:db/update
    app.Vexora("PUT", `/api/${dbType}/update`, async (req, res) => {
      try {
        const { id, title } = req.body || {};
        const idVal = dbType === "mysql" ? parseInt(id, 10) : id;
        await Vexora.update(targetDb, "user", { title }, "id = ?", [idVal]);
        return res.success(null, "Record updated successfully");
      } catch (err) {
        return res.error(err.message, 500);
      }
    });

    // GET /api/:db/exists
    app.Vexora("GET", `/api/${dbType}/exists`, async (req, res) => {
      try {
        const title = req.query?.title;
        const exists = await Vexora.exists(targetDb, "user", "title = ?", [title]);
        return res.success({ exists }, "Checked existence");
      } catch (err) {
        return res.error(err.message, 500);
      }
    });

    // DELETE /api/:db/delete
    app.Vexora("DELETE", `/api/${dbType}/delete`, async (req, res) => {
      try {
        const id = req.body?.id;
        const idVal = dbType === "mysql" ? parseInt(id, 10) : id;
        await Vexora.delete(targetDb, "user", "id = ?", [idVal]);
        return res.success(null, "Record deleted successfully");
      } catch (err) {
        return res.error(err.message, 500);
      }
    });
  }

  // 3. Test HTTP REST CRUD Endpoints
  console.log("3️⃣ Testing Live REST CRUD API Endpoints...");
  const baseUrl = `http://localhost:${port}`;

  for (const dbType of ["mysql", "mongo"]) {
    console.log(`\n    --- Running CRUD checks on: [${dbType.toUpperCase()}] ---`);

    // POST /api/:db/insert
    const createRes = await Vexora.http.post(`${baseUrl}/api/${dbType}/insert`, {
      title: `Vexora Matrix ${dbType}`,
      status: "active"
    });
    assert.strictEqual(createRes.ok, true);
    const createdId = createRes.data.data.id;
    assert.ok(createdId);
    console.log(`     ✅ POST /api/${dbType}/insert passed! (ID: ${createdId})`);

    // GET /api/:db/fetchAll
    const fetchAllRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetchAll`);
    assert.strictEqual(fetchAllRes.ok, true);
    assert.ok(fetchAllRes.data.data.length > 0);
    console.log(`     ✅ GET /api/${dbType}/fetchAll passed! (Count: ${fetchAllRes.data.data.length})`);

    // GET /api/:db/fetch
    const fetchRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetch`, { query: { id: createdId } });
    assert.strictEqual(fetchRes.ok, true);
    assert.strictEqual(fetchRes.data.data.title, `Vexora Matrix ${dbType}`);
    console.log(`     ✅ GET /api/${dbType}/fetch passed!`);

    // PUT /api/${dbType}/update
    const updateRes = await Vexora.http.put(`${baseUrl}/api/${dbType}/update`, {
      id: createdId,
      title: `Updated Vexora Matrix ${dbType}`
    });
    assert.strictEqual(updateRes.ok, true);
    console.log(`     ✅ PUT /api/${dbType}/update passed!`);

    // GET /api/${dbType}/exists
    const existsRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/exists`, {
      query: { title: `Updated Vexora Matrix ${dbType}` }
    });
    assert.strictEqual(existsRes.ok, true);
    assert.strictEqual(existsRes.data.data.exists, true);
    console.log(`     ✅ GET /api/${dbType}/exists passed!`);

    // DELETE /api/${dbType}/delete
    const deleteRes = await Vexora.http.delete(`${baseUrl}/api/${dbType}/delete`, {
      body: { id: createdId }
    });
    assert.strictEqual(deleteRes.ok, true);
    console.log(`     ✅ DELETE /api/${dbType}/delete passed!`);
  }

  // Close server
  console.log("\n4️⃣ Cleaning up and closing server...");
  app.close();
  await mysql.disconnect();
  console.log("   ✅ Done!");

  console.log("\n==========================================");
  console.log("🎉 ALL LIVE CRUD REST API CHECKS PASSED 100%!");
  console.log("==========================================\n");
}

runLiveCrudAllTest().catch(err => {
  console.error("❌ Live API test failed:", err);
  process.exit(1);
});
