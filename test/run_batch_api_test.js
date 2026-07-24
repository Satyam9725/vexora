import assert from "node:assert";
import Vexora from "../Vexora.js";
import { readDbConfig } from "../commands/helpers.js";
import BehaviorAnalyzer from "../security/BehaviorAnalyzer.js";

async function runBatchApiTest() {
  if (BehaviorAnalyzer) BehaviorAnalyzer.isEnabled = false;
  Vexora.config.set("DETECT_BOT_BEHAVIOR", "false");
  Vexora.config.set("SUSPICIOUS_THRESHOLD", "99999");

  console.log("==========================================");
  console.log("🚀 RUNNING MYSQL & MONGODB SEPARATE API ENDPOINT TESTS");
  console.log("==========================================\n");

  const port = 28376;
  const baseUrl = `http://localhost:${port}`;

  // 1. Connect to configured databases
  const configs = readDbConfig();
  console.log("Connecting to databases...");
  await Vexora.connect(configs.mongodb, "mongodb");
  await Vexora.connect(configs.auth, "auth");
  console.log("   ✅ Connected to MySQL and MongoDB!\n");

  // Ensure table is clean
  await Vexora.exec("auth", "DROP TABLE IF EXISTS user");
  await Vexora.exec("auth", "CREATE TABLE user (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), status VARCHAR(50))");

  // 2. Start Vexora Server
  console.log("Starting Vexora server...");
  const server = Vexora.start(port);
  await new Promise(r => setTimeout(r, 400));
  console.log("   ✅ Server started successfully!\n");

  try {
    for (const dbType of ["mysql", "mongo"]) {
      console.log(`\n======================================================`);
      console.log(`   Running Individual API Route checks for: [${dbType.toUpperCase()}]`);
      console.log(`======================================================`);

      // 1. Test Insert
      console.log(`👉 POST /api/${dbType}/insert ...`);
      const insertRes = await Vexora.http.post(`${baseUrl}/api/${dbType}/insert`, {
        title: `Dynamic ${dbType.toUpperCase()} User`,
        status: "active"
      });
      assert.strictEqual(insertRes.ok, true);
      assert.strictEqual(insertRes.data.status, true);
      const insertedId = insertRes.data.data.id;
      assert.ok(insertedId);
      console.log(`   ✅ Insert passed! Created ID: ${insertedId}`);

      // 2. Test FetchAll
      console.log(`👉 GET /api/${dbType}/fetchAll ...`);
      const fetchAllRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetchAll`);
      assert.strictEqual(fetchAllRes.ok, true);
      assert.strictEqual(fetchAllRes.data.status, true);
      assert.ok(Array.isArray(fetchAllRes.data.data));
      assert.ok(fetchAllRes.data.data.length > 0);
      console.log(`   ✅ FetchAll passed! Count: ${fetchAllRes.data.data.length}`);

      // 3. Test Fetch
      console.log(`👉 GET /api/${dbType}/fetch ...`);
      const fetchRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/fetch`, { query: { id: insertedId } });
      assert.strictEqual(fetchRes.ok, true);
      assert.strictEqual(fetchRes.data.status, true);
      console.log(`   ✅ Fetch passed! Got title: ${fetchRes.data.data.title}`);

      // 4. Test Update
      console.log(`👉 PUT /api/${dbType}/update ...`);
      const updateRes = await Vexora.http.put(`${baseUrl}/api/${dbType}/update`, {
        id: insertedId,
        title: `Updated ${dbType.toUpperCase()} User`
      });
      assert.strictEqual(updateRes.ok, true);
      assert.strictEqual(updateRes.data.status, true);
      console.log(`   ✅ Update passed!`);

      // 5. Test Exists
      console.log(`👉 GET /api/${dbType}/exists ...`);
      const existsRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/exists`, {
        query: { title: `Updated ${dbType.toUpperCase()} User` }
      });
      assert.strictEqual(existsRes.ok, true);
      assert.strictEqual(existsRes.data.data.exists, true);
      console.log(`   ✅ Exists passed!`);

      // 6. Test Paginate
      console.log(`👉 GET /api/${dbType}/paginate ...`);
      const paginateRes = await Vexora.http.get(`${baseUrl}/api/${dbType}/paginate`, {
        query: { page: 1, limit: 10 }
      });
      assert.strictEqual(paginateRes.ok, true);
      assert.strictEqual(paginateRes.data.status, true);
      assert.ok(paginateRes.data.data.items);
      console.log(`   ✅ Paginate passed!`);

      // 7. Test Delete
      console.log(`👉 DELETE /api/${dbType}/delete ...`);
      const deleteRes = await Vexora.http.delete(`${baseUrl}/api/${dbType}/delete`, {
        body: { id: insertedId }
      });
      assert.strictEqual(deleteRes.ok, true);
      assert.strictEqual(deleteRes.data.status, true);
      console.log(`   ✅ Delete passed!`);
    }

    console.log("\n==========================================");
    console.log("🎉 ALL SEPARATE MYSQL & MONGO API TESTS PASSED 100%!");
    console.log("==========================================\n");

    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error("\n❌ Separate API test failed:", err);
    if (server) server.close();
    process.exit(1);
  }
}

runBatchApiTest();
