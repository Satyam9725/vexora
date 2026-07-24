import assert from "node:assert";
import Vexora from "../Vexora.js";
import { readDbConfig } from "../commands/helpers.js";
import BehaviorAnalyzer from "../security/BehaviorAnalyzer.js";

async function testHttpClientLive() {
  if (BehaviorAnalyzer) BehaviorAnalyzer.isEnabled = false;
  Vexora.config.set("DETECT_BOT_BEHAVIOR", "false");
  Vexora.config.set("SUSPICIOUS_THRESHOLD", "99999");

  console.log("==========================================");
  console.log("🌐 VEXORA.HTTP CLIENT & LIVE API ENDPOINTS TEST");
  console.log("==========================================\n");

  const port = 34569;
  const baseUrl = `http://localhost:${port}`;

  // 1. Connect to configured databases
  const configs = readDbConfig();
  console.log("Connecting to all configured databases...");
  await Vexora.connect(configs.mongodb, "mongodb");
  await Vexora.connect(configs.auth, "auth");
  console.log("   ✅ Connected to both MongoDB and MySQL databases!");

  console.log("Creating user table on MySQL and cleaning up...");
  await Vexora.exec("auth", "DROP TABLE IF EXISTS user");
  await Vexora.exec("auth", "CREATE TABLE user (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), status VARCHAR(50))");
  try {
    await Vexora.delete("mongodb", "user", {});
  } catch (e) {}

  // 2. Start Vexora Server
  console.log("2️⃣ Starting Vexora server on port", port, "...");
  const server = Vexora.start(port);

  // Give server time to listen
  await new Promise(r => setTimeout(r, 300));
  console.log("   ✅ Server started successfully!\n");

  try {
    for (const targetDb of ["auth", "mongodb"]) {
      console.log(`\n======================================================`);
      console.log(`   Running API Routes Verification for DB: [${targetDb.toUpperCase()}]`);
      console.log(`======================================================\n`);

      // 1. TEST POST REQUEST (Create User -> .api_routes/user_create.js)
      console.log(`👉 Testing Vexora.http.post() -> /api/user_create?db=${targetDb}...`);
      const postRes = await Vexora.http.post(
        `${baseUrl}/api/user_create?db=${targetDb}`,
        { title: "Satyam Kumar via HTTP Client", status: "active" },
        { headers: { "Authorization": "Bearer TEST_TOKEN_123" } }
      );
      assert.strictEqual(postRes.ok, true);
      assert.strictEqual(postRes.status, 200);
      assert.strictEqual(postRes.data.status, true);
      console.log("POST response data:", postRes.data);
      const userId = postRes.data.data.id;
      assert.ok(userId);
      console.log(`   ✅ POST request passed! Created ID:`, userId);

      // 2. TEST GET REQUEST (Fetch Users -> .api_routes/users_fetch.js)
      console.log(`\n👉 Testing Vexora.http.get() -> /api/users_fetch?db=${targetDb}...`);
      const getRes = await Vexora.http.get(`${baseUrl}/api/users_fetch?db=${targetDb}`, {
        headers: { "Accept": "application/json" }
      });
      console.log("GET response data:", getRes.data);
      assert.strictEqual(getRes.ok, true);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.data.status, true);
      assert.ok(Array.isArray(getRes.data.data));
      assert.ok(getRes.data.data.length > 0);
      console.log("   ✅ GET request passed! Users count:", getRes.data.data.length);

      // 3. TEST PUT UPDATE (Update User -> .api_routes/user_update.js)
      console.log(`\n👉 Testing Vexora.http.put() -> /api/user_update?db=${targetDb}...`);
      const updateRes = await Vexora.http.put(`${baseUrl}/api/user_update?db=${targetDb}`, { id: userId, title: "Updated Satyam" });
      assert.strictEqual(updateRes.ok, true);
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.status, true);
      console.log("   ✅ PUT update request passed! Message:", updateRes.data.message);

      // 4. TEST GET QUERY (User Exists -> .api_routes/user_exists.js)
      console.log(`\n👉 Testing Vexora.http.get() with query -> /api/user_exists?db=${targetDb}...`);
      const existsRes = await Vexora.http.get(`${baseUrl}/api/user_exists?db=${targetDb}`, {
        query: { title: "Updated Satyam" }
      });
      assert.strictEqual(existsRes.ok, true);
      assert.strictEqual(existsRes.status, 200);
      assert.strictEqual(existsRes.data.status, true);
      assert.strictEqual(existsRes.data.data.exists, true);
      console.log("   ✅ GET query request passed! Result:", existsRes.data.data);

      // 5. TEST PAGINATE GET (Users Paginate -> .api_routes/users_paginate.js)
      console.log(`\n👉 Testing Vexora.http.get() with pagination -> /api/users_paginate?db=${targetDb}...`);
      const pageRes = await Vexora.http.get(`${baseUrl}/api/users_paginate?db=${targetDb}`, {
        query: { page: 1, limit: 2 }
      });
      assert.strictEqual(pageRes.ok, true);
      assert.strictEqual(pageRes.status, 200);
      assert.strictEqual(pageRes.data.status, true);
      assert.ok(pageRes.data.data.items);
      console.log("   ✅ PAGINATE request passed! Current page items:", pageRes.data.data.items.length);

      // 6. TEST DELETE REQUEST (Delete User -> .api_routes/user_delete.js)
      console.log(`\n👉 Testing Vexora.http.delete() -> /api/user_delete?db=${targetDb}...`);
      const delRes = await Vexora.http.delete(`${baseUrl}/api/user_delete?db=${targetDb}`, {
        body: { id: userId },
        headers: { "Authorization": "Bearer TOKEN_456" }
      });
      assert.strictEqual(delRes.ok, true);
      assert.strictEqual(delRes.status, 200);
      assert.strictEqual(delRes.data.status, true);
      console.log("   ✅ DELETE request passed! Message:", delRes.data.message);
    }

    console.log("\n==========================================");
    console.log("🎉 ALL VEXORA.HTTP CLIENT & LIVE API TESTS PASSED 100%!");
    console.log("==========================================\n");

    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error("\n❌ Vexora.http test failed:", err);
    if (server) server.close();
    process.exit(1);
  }
}

testHttpClientLive();
