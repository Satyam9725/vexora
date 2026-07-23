import assert from "node:assert";
import Vexora from "../Vexora.js";

async function testHttpClientLive() {
  console.log("==========================================");
  console.log("🌐 VEXORA.HTTP CLIENT & LIVE API ENDPOINTS TEST");
  console.log("==========================================\n");

  const port = 34569;
  const baseUrl = `http://localhost:${port}`;

  // 1. Start Vexora Server
  console.log("1️⃣ Starting Vexora server on port", port, "...");
  const server = Vexora.start(port);

  // Give server time to listen
  await new Promise(r => setTimeout(r, 300));
  console.log("   ✅ Server started successfully!\n");

  try {
    // 2. TEST POST REQUEST (Create User -> .api_routes/user_create.js)
    console.log("2️⃣ Testing Vexora.http.post() -> /api/user_create...");
    const postRes = await Vexora.http.post(
      `${baseUrl}/api/user_create`,
      { title: "Satyam Kumar via HTTP Client", status: "active" },
      { headers: { "Authorization": "Bearer TEST_TOKEN_123" } }
    );
    assert.strictEqual(postRes.ok, true);
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postRes.data.status, true);
    assert.ok(postRes.data.data.id);
    console.log("   ✅ POST request passed! Response:", postRes.data.message, "Created ID:", postRes.data.data.id);

    // 3. TEST GET REQUEST (Fetch Users -> .api_routes/users_fetch.js)
    console.log("\n3️⃣ Testing Vexora.http.get() -> /api/users_fetch...");
    const getRes = await Vexora.http.get(`${baseUrl}/api/users_fetch`, {
      headers: { "Accept": "application/json" }
    });
    assert.strictEqual(getRes.ok, true);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.status, true);
    assert.ok(Array.isArray(getRes.data.data));
    console.log("   ✅ GET request passed! Users count:", getRes.data.data.length);

    // 4. TEST PUT UPDATE (Update User -> .api_routes/user_update.js)
    console.log("\n4️⃣ Testing Vexora.http.put() -> /api/user_update...");
    const updateRes = await Vexora.http.put(`${baseUrl}/api/user_update`, { id: 1, title: "Updated Satyam" });
    assert.strictEqual(updateRes.ok, true);
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.status, true);
    console.log("   ✅ PUT update request passed! Message:", updateRes.data.message);

    // 5. TEST GET QUERY (User Exists -> .api_routes/user_exists.js)
    console.log("\n5️⃣ Testing Vexora.http.get() with query -> /api/user_exists...");
    const existsRes = await Vexora.http.get(`${baseUrl}/api/user_exists`, {
      query: { title: "VExora" }
    });
    assert.strictEqual(existsRes.ok, true);
    assert.strictEqual(existsRes.status, 200);
    assert.strictEqual(existsRes.data.status, true);
    assert.strictEqual(typeof existsRes.data.data.exists, "boolean");
    console.log("   ✅ GET query request passed! Result:", existsRes.data.data);

    // 6. TEST PAGINATE GET (Users Paginate -> .api_routes/users_paginate.js)
    console.log("\n6️⃣ Testing Vexora.http.get() with pagination -> /api/users_paginate...");
    const pageRes = await Vexora.http.get(`${baseUrl}/api/users_paginate`, {
      query: { page: 1, limit: 2 }
    });
    assert.strictEqual(pageRes.ok, true);
    assert.strictEqual(pageRes.status, 200);
    assert.strictEqual(pageRes.data.status, true);
    assert.ok(pageRes.data.data.items);
    console.log("   ✅ PAGINATE request passed! Current page items:", pageRes.data.data.items.length);

    // 7. TEST DELETE REQUEST (Delete User -> .api_routes/user_delete.js)
    console.log("\n7️⃣ Testing Vexora.http.delete() -> /api/user_delete...");
    const delRes = await Vexora.http.delete(`${baseUrl}/api/user_delete`, {
      body: { id: 9999 },
      headers: { "Authorization": "Bearer TOKEN_456" }
    });
    assert.strictEqual(delRes.ok, true);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.status, true);
    console.log("   ✅ DELETE request passed! Message:", delRes.data.message);

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
