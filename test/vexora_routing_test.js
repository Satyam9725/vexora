import assert from "node:assert";
import Vexora from "../Vexora.js";

async function testVexoraNativeRouting() {
  console.log("==========================================");
  console.log("🚀 VEXORA-NATIVE ROUTING SYNTAX TEST");
  console.log("==========================================\n");

  const port = 34572;
  const baseUrl = `http://localhost:${port}`;

  console.log("1️⃣ Starting Vexora server on port", port, "...");
  const app = Vexora.start(port);

  // Define routes using Vexora-native app.Vexora(method, uri, handler) signature
  app.Vexora("GET", "/info", (req, res) => {
    return res.success({ version: "1.5.4" }, "Info Loaded");
  });

  app.Vexora("POST", "/data", (req, res) => {
    return res.success(req.body, "Received!");
  });

  app.Vexora("PUT", "/users/1", (req, res) => {
    return res.success(req.body, "Updated!");
  });

  app.Vexora("DELETE", "/users/1", (req, res) => {
    return res.success(null, "Deleted!");
  });

  app.Vexora("ANY", "/ping", (req, res) => {
    return res.json({ pong: true, method: req.method });
  });

  app.Vexora(["GET", "POST"], "/form", (req, res) => {
    return res.json({ status: true, method: req.method });
  });

  await new Promise(r => setTimeout(r, 300));
  console.log("   ✅ Server started with app.Vexora() routes!\n");

  try {
    // Test 1: GET /api/info
    console.log("2️⃣ Testing app.Vexora('GET', '/info')...");
    const infoRes = await Vexora.http.get(`${baseUrl}/api/info`);
    console.log("   DEBUG infoRes:", infoRes.status, infoRes.data);
    assert.strictEqual(infoRes.ok, true);
    assert.strictEqual(infoRes.data.data.version, "1.5.4");
    console.log("   ✅ GET route passed!");

    // Test 2: POST /api/data
    console.log("\n3️⃣ Testing app.Vexora('POST', '/data')...");
    const postRes = await Vexora.http.post(`${baseUrl}/api/data`, { name: "Vexora Test" });
    assert.strictEqual(postRes.ok, true);
    assert.strictEqual(postRes.data.data.name, "Vexora Test");
    console.log("   ✅ POST route passed!");

    // Test 3: PUT /api/users/1
    console.log("\n4️⃣ Testing app.Vexora('PUT', '/users/1')...");
    const putRes = await Vexora.http.put(`${baseUrl}/api/users/1`, { role: "admin" });
    assert.strictEqual(putRes.ok, true);
    assert.strictEqual(putRes.data.data.role, "admin");
    console.log("   ✅ PUT route passed!");

    // Test 4: DELETE /api/users/1
    console.log("\n5️⃣ Testing app.Vexora('DELETE', '/users/1')...");
    const delRes = await Vexora.http.delete(`${baseUrl}/api/users/1`);
    assert.strictEqual(delRes.ok, true);
    assert.strictEqual(delRes.data.message, "Deleted!");
    console.log("   ✅ DELETE route passed!");

    // Test 5: ANY /api/ping
    console.log("\n6️⃣ Testing app.Vexora('ANY', '/ping')...");
    const pingGet = await Vexora.http.get(`${baseUrl}/api/ping`);
    const pingPost = await Vexora.http.post(`${baseUrl}/api/ping`, {});
    assert.strictEqual(pingGet.data.pong, true);
    assert.strictEqual(pingPost.data.pong, true);
    console.log("   ✅ ANY wildcard method route passed for GET and POST!");

    // Test 6: Multiple methods ['GET', 'POST'] /api/form
    Vexora.resetSuspiciousTracker();
    console.log("\n7️⃣ Testing app.Vexora(['GET', 'POST'], '/form')...");
    const formGet = await Vexora.http.get(`${baseUrl}/api/form`);
    const formPost = await Vexora.http.post(`${baseUrl}/api/form`, {});
    assert.strictEqual(formGet.data.method, "GET");
    assert.strictEqual(formPost.data.method, "POST");
    console.log("   ✅ Array methods ['GET', 'POST'] route passed!");

    console.log("\n==========================================");
    console.log("🎉 ALL VEXORA-NATIVE APP.VEXORA() ROUTE TESTS PASSED 100%!");
    console.log("==========================================\n");

    app.close();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Vexora-native route test failed:", err);
    if (app) app.close();
    process.exit(1);
  }
}

testVexoraNativeRouting();
