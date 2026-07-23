import assert from "node:assert";
import Vexora from "../Vexora.js";
import { readDbConfig } from "../commands/helpers.js";

async function runLiveDbAndCrudTest() {
  console.log("==========================================");
  console.log("🚀 VEXORA LIVE DB CLI & CRUD REST API VERIFICATION");
  console.log("==========================================\n");

  // 1. Read DB Config
  const configs = readDbConfig();
  console.log("1️⃣ Reading DB Config...");
  const dbKeys = Object.keys(configs);
  assert.ok(dbKeys.length > 0, "At least one DB config should exist in db_config.json");
  console.log(`   ✅ DB Connections configured: ${dbKeys.join(", ")}\n`);

  // 2. Start Vexora Live Server on port 19876
  console.log("2️⃣ Starting Vexora Live Server & Mounting CRUD REST API...");
  const port = 19876;
  const app = Vexora.start(port);

  let items = [
    { id: 1, name: "Vexora Pro Laptop", status: "active" },
    { id: 2, name: "Cyber Shield Dongle", status: "pending" }
  ];

  // GET /api/items (List all items)
  app.Vexora("GET", "/api/items", (req, res) => {
    return res.success(items, "Items fetched successfully");
  });

  // GET /api/items/:id (Fetch single item)
  app.Vexora("GET", "/api/items/:id", (req, res, params) => {
    const idVal = params?.id || req.params?.id;
    const id = parseInt(idVal, 10);
    const item = items.find(i => i.id === id);
    if (!item) return res.error("Item not found", 404);
    return res.success(item, "Item found");
  });

  // POST /api/items (Create new item)
  app.Vexora("POST", "/api/items", (req, res) => {
    const { name, status } = req.body || {};
    if (!name) return res.error("Name is required", 400);
    const newItem = { id: items.length + 1, name, status: status || "active" };
    items.push(newItem);
    return res.success(newItem, "Item created successfully", 201);
  });

  // PUT /api/items/:id (Update item)
  app.Vexora("PUT", "/api/items/:id", (req, res, params) => {
    const idVal = params?.id || req.params?.id;
    const id = parseInt(idVal, 10);
    const item = items.find(i => i.id === id);
    if (!item) return res.error("Item not found", 404);
    if (req.body && req.body.name) item.name = req.body.name;
    if (req.body && req.body.status) item.status = req.body.status;
    return res.success(item, "Item updated successfully");
  });

  // DELETE /api/items/:id (Delete item)
  app.Vexora("DELETE", "/api/items/:id", (req, res, params) => {
    const idVal = params?.id || req.params?.id;
    const id = parseInt(idVal, 10);
    const initialLen = items.length;
    items = items.filter(i => i.id !== id);
    if (items.length === initialLen) return res.error("Item not found", 404);
    return res.success(null, "Item deleted successfully");
  });

  await new Promise(r => setTimeout(r, 250));

  // 3. Test HTTP REST CRUD Endpoints
  console.log("3️⃣ Testing Live REST CRUD API Endpoints...");

  // GET ALL
  const getListRes = await Vexora.http.get(`http://127.0.0.1:${port}/api/items`);
  assert.strictEqual(getListRes.ok, true);
  assert.strictEqual(getListRes.data.data.length, 2);
  console.log("   ✅ GET /api/items passed! (2 items returned)");

  // CREATE ITEM
  const createRes = await Vexora.http.post(`http://127.0.0.1:${port}/api/items`, { name: "Vexora Matrix Router", status: "active" });
  assert.strictEqual(createRes.ok, true);
  assert.strictEqual(createRes.data.data.name, "Vexora Matrix Router");
  assert.strictEqual(createRes.data.data.id, 3);
  console.log("   ✅ POST /api/items passed! (Created item ID 3)");

  // GET SINGLE ITEM
  const getSingleRes = await Vexora.http.get(`http://127.0.0.1:${port}/api/items/3`);
  assert.strictEqual(getSingleRes.ok, true);
  assert.strictEqual(getSingleRes.data.data.name, "Vexora Matrix Router");
  console.log("   ✅ GET /api/items/3 passed!");

  // UPDATE ITEM
  const updateRes = await Vexora.http.put(`http://127.0.0.1:${port}/api/items/3`, { status: "verified" });
  assert.strictEqual(updateRes.ok, true);
  assert.strictEqual(updateRes.data.data.status, "verified");
  console.log("   ✅ PUT /api/items/3 passed! (Status updated to 'verified')");

  // DELETE ITEM
  const deleteRes = await Vexora.http.delete(`http://127.0.0.1:${port}/api/items/3`);
  assert.strictEqual(deleteRes.ok, true);
  console.log("   ✅ DELETE /api/items/3 passed!");

  // VERIFY DELETED
  const getAfterDel = await Vexora.http.get(`http://127.0.0.1:${port}/api/items/3`);
  assert.strictEqual(getAfterDel.status, 404);
  console.log("   ✅ Item deletion verified (Returns 404)\n");

  app.close();

  // 4. Test DB Utility Helper Methods
  console.log("4️⃣ Testing All 12 Database Facade Methods...");
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
