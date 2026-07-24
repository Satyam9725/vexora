import assert from "node:assert";
import Vexora from "../Vexora.js";
import { readDbConfig } from "../commands/helpers.js";
import BehaviorAnalyzer from "../security/BehaviorAnalyzer.js";

async function runLiveDbAndCrudTest() {
  Vexora.config.set("DETECT_BOT_BEHAVIOR", "false");
  Vexora.config.set("SUSPICIOUS_THRESHOLD", "99999");
  if (BehaviorAnalyzer) BehaviorAnalyzer.isEnabled = false;
  console.log("==========================================");
  console.log("🚀 VEXORA LIVE DB CLI & CRUD REST API VERIFICATION");
  console.log("==========================================\n");

  // 1. Read DB Config
  const configs = readDbConfig();
  console.log("1️⃣ Reading DB Config...");
  const dbKeys = Object.keys(configs);
  assert.ok(dbKeys.length > 0, "At least one DB config should exist in db_config.json");
  console.log(`   ✅ DB Connections configured: ${dbKeys.join(", ")}\n`);

  console.log("Connecting to all configured databases...");
  await Vexora.connect(configs.mongodb, "mongodb");
  await Vexora.connect(configs.auth, "auth");
  console.log("   ✅ Connected to both MongoDB and MySQL databases!");

  console.log("Creating test_items table on MySQL...");
  await Vexora.exec("auth", "CREATE TABLE IF NOT EXISTS test_items (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), status VARCHAR(50))");

  console.log("Emptying test_items tables...");
  await Vexora.exec("auth", "DELETE FROM test_items");
  try {
    await Vexora.delete("mongodb", "test_items", {});
  } catch (e) {
    // If collection doesn't exist, ignore
  }

  // 2. Start Vexora Live Server on port 19888
  console.log("\n2️⃣ Starting Vexora Live Server & Mounting CRUD REST API...");
  const port = 19888;
  const app = Vexora.start(port);

  // GET /api/items (List all items)
  app.Vexora("GET", "/api/items", async (req, res) => {
    const db = req.query?.db || "auth";
    try {
      let items = [];
      if (db === "mongodb") {
        items = await Vexora.fetchAll("mongodb", "test_items", {});
      } else {
        items = await Vexora.fetchAll("auth", "SELECT * FROM test_items");
      }
      return res.success(items, "Items fetched successfully");
    } catch (err) {
      return res.error(err.message, 500);
    }
  });

  // GET /api/items/:id (Fetch single item)
  app.Vexora("GET", "/api/items/:id", async (req, res, params) => {
    const db = req.query?.db || "auth";
    const idVal = params?.id || req.params?.id;
    try {
      let item = null;
      if (db === "mongodb") {
        const { ObjectId } = await import("mongodb");
        let filter = {};
        if (/^[0-9a-fA-F]{24}$/.test(idVal)) {
          filter = { _id: new ObjectId(idVal) };
        } else {
          filter = { id: parseInt(idVal, 10) };
        }
        item = await Vexora.fetch("mongodb", "test_items", filter);
      } else {
        const id = parseInt(idVal, 10);
        item = await Vexora.fetch("auth", "SELECT * FROM test_items WHERE id = ?", [id]);
      }
      if (!item) return res.error("Item not found", 404);
      return res.success(item, "Item found");
    } catch (err) {
      return res.error(err.message, 500);
    }
  });

  // POST /api/items (Create new item)
  app.Vexora("POST", "/api/items", async (req, res) => {
    const db = req.query?.db || "auth";
    const { name, status } = req.body || {};
    if (!name) return res.error("Name is required", 400);

    try {
      let newItem;
      if (db === "mongodb") {
        const insertId = await Vexora.insert("mongodb", "test_items", { name, status: status || "active" });
        newItem = { _id: insertId, name, status: status || "active" };
      } else {
        const insertId = await Vexora.insert("auth", "test_items", { name, status: status || "active" });
        newItem = { id: insertId, name, status: status || "active" };
      }
      return res.success(newItem, "Item created successfully", 201);
    } catch (err) {
      return res.error(err.message, 500);
    }
  });

  // PUT /api/items/:id (Update item)
  app.Vexora("PUT", "/api/items/:id", async (req, res, params) => {
    const db = req.query?.db || "auth";
    const idVal = params?.id || req.params?.id;
    const { name, status } = req.body || {};

    try {
      if (db === "mongodb") {
        const { ObjectId } = await import("mongodb");
        let filter = {};
        if (/^[0-9a-fA-F]{24}$/.test(idVal)) {
          filter = { _id: new ObjectId(idVal) };
        } else {
          filter = { id: parseInt(idVal, 10) };
        }
        const data = {};
        if (name) data.name = name;
        if (status) data.status = status;
        await Vexora.update("mongodb", "test_items", data, filter);
        const item = await Vexora.fetch("mongodb", "test_items", filter);
        return res.success(item, "Item updated successfully");
      } else {
        const id = parseInt(idVal, 10);
        const data = {};
        if (name) data.name = name;
        if (status) data.status = status;
        await Vexora.update("auth", "test_items", data, "id = ?", [id]);
        const item = await Vexora.fetch("auth", "SELECT * FROM test_items WHERE id = ?", [id]);
        return res.success(item, "Item updated successfully");
      }
    } catch (err) {
      return res.error(err.message, 500);
    }
  });

  // DELETE /api/items/:id (Delete item)
  app.Vexora("DELETE", "/api/items/:id", async (req, res, params) => {
    const db = req.query?.db || "auth";
    const idVal = params?.id || req.params?.id;

    try {
      if (db === "mongodb") {
        const { ObjectId } = await import("mongodb");
        let filter = {};
        if (/^[0-9a-fA-F]{24}$/.test(idVal)) {
          filter = { _id: new ObjectId(idVal) };
        } else {
          filter = { id: parseInt(idVal, 10) };
        }
        const deletedCount = await Vexora.delete("mongodb", "test_items", filter);
        if (deletedCount === 0) return res.error("Item not found", 404);
        return res.success(null, "Item deleted successfully");
      } else {
        const id = parseInt(idVal, 10);
        await Vexora.delete("auth", "test_items", "id = ?", [id]);
        return res.success(null, "Item deleted successfully");
      }
    } catch (err) {
      return res.error(err.message, 500);
    }
  });

  await new Promise(r => setTimeout(r, 250));

  // 3. Test HTTP REST CRUD Endpoints
  console.log("3️⃣ Testing Live REST CRUD API Endpoints...");

  for (const targetDb of ["auth", "mongodb"]) {
    console.log(`\n    --- Running CRUD checks on target database: [${targetDb.toUpperCase()}] ---`);

    // GET ALL (Should be 0)
    const getListRes = await Vexora.http.get(`http://127.0.0.1:${port}/api/items?db=${targetDb}`);
    assert.strictEqual(getListRes.ok, true);
    assert.strictEqual(getListRes.data.data.length, 0);
    console.log(`     ✅ GET /api/items?db=${targetDb} passed! (0 items initially)`);

    // CREATE ITEM 1
    const createRes = await Vexora.http.post(`http://127.0.0.1:${port}/api/items?db=${targetDb}`, { name: "Vexora Matrix Router", status: "active" });
    assert.strictEqual(createRes.ok, true);
    assert.strictEqual(createRes.data.data.name, "Vexora Matrix Router");
    const item1Id = createRes.data.data._id || createRes.data.data.id;
    assert.ok(item1Id);
    console.log(`     ✅ POST /api/items?db=${targetDb} passed! (Created item ID: ${item1Id})`);

    // GET SINGLE ITEM
    const getSingleRes = await Vexora.http.get(`http://127.0.0.1:${port}/api/items/${item1Id}?db=${targetDb}`);
    assert.strictEqual(getSingleRes.ok, true);
    assert.strictEqual(getSingleRes.data.data.name, "Vexora Matrix Router");
    console.log(`     ✅ GET /api/items/${item1Id}?db=${targetDb} passed!`);

    // UPDATE ITEM
    const updateRes = await Vexora.http.put(`http://127.0.0.1:${port}/api/items/${item1Id}?db=${targetDb}`, { status: "verified" });
    assert.strictEqual(updateRes.ok, true);
    assert.strictEqual(updateRes.data.data.status, "verified");
    console.log(`     ✅ PUT /api/items/${item1Id}?db=${targetDb} passed! (Status updated to 'verified')`);

    // DELETE ITEM
    const deleteRes = await Vexora.http.delete(`http://127.0.0.1:${port}/api/items/${item1Id}?db=${targetDb}`);
    assert.strictEqual(deleteRes.ok, true);
    console.log(`     ✅ DELETE /api/items/${item1Id}?db=${targetDb} passed!`);

    // VERIFY DELETED
    const getAfterDel = await Vexora.http.get(`http://127.0.0.1:${port}/api/items/${item1Id}?db=${targetDb}`);
    assert.strictEqual(getAfterDel.status, 404);
    console.log(`     ✅ Item deletion verified (Returns 404)`);
  }

  app.close();

  // 4. Test DB Utility Helper Methods
  console.log("\n4️⃣ Testing All 12 Database Facade Methods...");
  const dbMethods = [
    "fetch", "fetchAll", "fetchColumn", "query", "exec",
    "insert", "update", "delete", "upsert", "exists", "count", "paginate"
  ];
  for (const m of dbMethods) {
    assert.strictEqual(typeof Vexora[m], "function", `Vexora.${m} must be an exported function`);
  }
  console.log("   ✅ All 12 Database Methods verified!\n");

  console.log("==========================================");
  console.log("🎉 ALL LIVE DB CLI & CRUD REST API CHECKS PASSED 100%!");
  console.log("==========================================\n");
  setTimeout(() => process.exit(0), 100);
}

runLiveDbAndCrudTest();
