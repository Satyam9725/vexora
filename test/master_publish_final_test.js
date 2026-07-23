import assert from "node:assert";
import Vexora from "../Vexora.js";
import http from "node:http";

async function runFinalPublishVerification() {
  console.log("==========================================");
  console.log("🚀 VEXORA FRAMEWORK — FINAL PRE-PUBLISH MASTER TEST");
  console.log("==========================================\n");

  // ── 1. SERVER & ROUTING ───────────────────────────────────────
  console.log("1️⃣ Testing Server, CORS, Static & Native Routing...");
  const port = 21000;
  const app = Vexora.start(port);

  assert.strictEqual(typeof app.cors, "function", "app.cors must be a function");
  assert.strictEqual(typeof app.static, "function", "app.static must be a function");
  assert.strictEqual(typeof app.Vexora, "function", "app.Vexora must be a function");

  app.cors(["*"]);

  app.Vexora("GET", "/api/test_get", (req, res) => {
    const q = req.input("q");
    return res.success({ query_q: q }, "GET success");
  });

  app.Vexora("POST", "/api/test_post", (req, res) => {
    const name = req.input("name");
    const role = req.input("role");
    return res.success({ name, role }, "POST success", 201);
  });

  app.Vexora("PUT", "/api/test_put", (req, res) => {
    return res.success({ updated: true }, "PUT success");
  });

  app.Vexora("DELETE", "/api/test_delete", (req, res) => {
    return res.success({ deleted: true }, "DELETE success");
  });

  await new Promise(r => setTimeout(r, 200));

  // ── 2. HTTP CLIENT FACADE (Vexora.http) ────────────────────────
  console.log("2️⃣ Testing Vexora.http Client (GET, POST, PUT, DELETE)...");

  // HTTP GET with query parameters
  const getRes = await Vexora.http.get(`http://127.0.0.1:${port}/api/test_get`, {
    query: { q: "vexora" },
    headers: { "Accept": "application/json" }
  });
  assert.strictEqual(getRes.ok, true);
  assert.strictEqual(getRes.data.data.query_q, "vexora");
  console.log("   ✅ Vexora.http.get passed!");

  // HTTP POST with body and headers
  const postRes = await Vexora.http.post(
    `http://127.0.0.1:${port}/api/test_post`,
    { name: "Satyam Kumar", role: "developer" },
    { headers: { "Authorization": "Bearer TEST_TOKEN" } }
  );
  assert.strictEqual(postRes.ok, true);
  assert.strictEqual(postRes.data.data.name, "Satyam Kumar");
  assert.strictEqual(postRes.data.data.role, "developer");
  console.log("   ✅ Vexora.http.post passed!");

  // HTTP PUT
  const putRes = await Vexora.http.put(`http://127.0.0.1:${port}/api/test_put`, { role: "lead" });
  assert.strictEqual(putRes.ok, true);
  assert.strictEqual(putRes.data.data.updated, true);
  console.log("   ✅ Vexora.http.put passed!");

  // HTTP DELETE
  const delRes = await Vexora.http.delete(`http://127.0.0.1:${port}/api/test_delete`, {
    headers: { "Authorization": "Bearer token" }
  });
  assert.strictEqual(delRes.ok, true);
  assert.strictEqual(delRes.data.data.deleted, true);
  console.log("   ✅ Vexora.http.delete passed!\n");

  app.close();

  // ── 3. DATABASE FACADE (All 12 Methods) ────────────────────────
  console.log("3️⃣ Testing All Database Facade Methods...");
  const dbMethods = [
    "fetch", "fetchAll", "fetchColumn", "query", "exec",
    "insert", "update", "delete", "upsert", "exists", "count", "paginate",
    "begin", "commit", "rollback"
  ];
  for (const m of dbMethods) {
    assert.strictEqual(typeof Vexora[m], "function", `Vexora.${m} must exist`);
  }
  console.log("   ✅ Database Facade Methods verified!\n");

  // ── 4. RAM CACHE (Redis Mock) ───────────────────────────────────
  console.log("4️⃣ Testing Vexora.Redis Cache Engine...");
  Vexora.Redis.set("test_key", "test_val", 60);
  assert.strictEqual(Vexora.Redis.get("test_key"), "test_val");
  assert.strictEqual(Vexora.Redis.has("test_key"), true);

  Vexora.Redis.incr("test_counter", 5);
  assert.strictEqual(Vexora.Redis.get("test_counter"), 5);
  Vexora.Redis.decr("test_counter", 2);
  assert.strictEqual(Vexora.Redis.get("test_counter"), 3);

  Vexora.Redis.del("test_key");
  assert.strictEqual(Vexora.Redis.has("test_key"), false);

  const userCache = Vexora.Redis.user("usr_101");
  userCache.set("profile", { name: "Satyam" });
  assert.strictEqual(userCache.has("profile"), true);
  assert.strictEqual(userCache.get("profile").name, "Satyam");
  userCache.del("profile");

  assert.strictEqual(typeof Vexora.info_redis, "function");
  console.log("   ✅ Vexora.Redis Cache Engine passed!\n");

  // ── 5. SECURITY ENGINES ─────────────────────────────────────────
  console.log("5️⃣ Testing Security Engines (CSRF, TokenVault, Protect)...");
  const csrfToken = Vexora.csrf.generate({ req: { socket: { remoteAddress: "127.0.0.1" } }, response: { cookie: () => {} } });
  assert.ok(csrfToken);
  assert.strictEqual(typeof Vexora.csrf.verify, "function");

  const sealResult = Vexora.TokenVault.seal({ userId: 99 }, "masterKey", "1H", "auth");
  assert.strictEqual(sealResult.status, true);
  assert.ok(sealResult.token);
  const unsealed = Vexora.TokenVault.unseal(sealResult.token, "masterKey", "auth");
  assert.strictEqual(unsealed.status, true);
  assert.strictEqual(unsealed.data.userId, 99);

  assert.strictEqual(typeof Vexora.protect, "function");
  assert.strictEqual(typeof Vexora.verifyCaptcha, "function");
  console.log("   ✅ Security Engines passed!\n");

  // ── 6. SESSIONS ────────────────────────────────────────────────
  console.log("6️⃣ Testing Session Manager...");
  assert.strictEqual(typeof Vexora.ss.set, "function");
  assert.strictEqual(typeof Vexora.ss.get, "function");
  assert.strictEqual(typeof Vexora.ss.unset, "function");
  assert.strictEqual(typeof Vexora.ss.reset, "function");
  assert.strictEqual(typeof Vexora.ss.regenerate, "function");
  assert.strictEqual(typeof Vexora.ss.info, "function");
  console.log("   ✅ Session Manager passed!\n");

  // ── 7. HELPERS & CRYPTOGRAPHY ──────────────────────────────────
  console.log("7️⃣ Testing Helpers & Cryptography...");
  const hash = Vexora.Helper.hashPassword("secret123");
  assert.ok(hash.startsWith("$2y$"));
  assert.strictEqual(Vexora.Helper.verifyPassword("secret123", hash), true);

  const enc = Vexora.Helper.encrypt("SecretData", "mySecretKey");
  const dec = Vexora.Helper.decrypt(enc, "mySecretKey");
  assert.strictEqual(dec, "SecretData");

  const randTok = Vexora.Helper.randomToken(16);
  assert.strictEqual(randTok.length, 32);

  const randNum = Vexora.Helper.randomInt(10, 50);
  assert.ok(randNum >= 10 && randNum <= 50);

  const uid = Vexora.Helper.uuid();
  assert.ok(uid.length > 20);
  console.log("   ✅ Helpers & Cryptography passed!\n");

  // ── 8. COMMUNICATION, QUEUE & STORAGE ──────────────────────────
  console.log("8️⃣ Testing Communication, Queue, Schedule, Storage & Validation...");
  assert.strictEqual(typeof Vexora.mail.send, "function");
  assert.strictEqual(typeof Vexora.WebSocket, "function");
  assert.strictEqual(typeof Vexora.Queue.define, "function");
  assert.strictEqual(typeof Vexora.Queue.dispatch, "function");
  assert.strictEqual(typeof Vexora.Schedule, "function");

  assert.strictEqual(typeof Vexora.Storage.createToken, "function");
  assert.strictEqual(typeof Vexora.Storage.handle, "function");
  assert.strictEqual(typeof Vexora.Storage.decrypt, "function");

  // Validator test
  const v = Vexora.Validator.make({ email: "invalid-email" }, { email: "required|email" });
  assert.strictEqual(v.fails(), true);
  assert.ok(v.getErrors().email);
  console.log("   ✅ Communication, Queue, Storage & Validator passed!\n");

  // ── 9. CONFIGURATION & REQUEST/RESPONSE CONTEXT ───────────────
  console.log("9️⃣ Testing Config & Request/Response Context...");
  assert.strictEqual(typeof Vexora.config.get, "function");
  assert.strictEqual(typeof Vexora.config.boolean, "function");
  assert.strictEqual(typeof Vexora.config.number, "function");
  assert.strictEqual(typeof Vexora.config.all, "function");

  assert.strictEqual(typeof Vexora.Request.all, "function");
  assert.strictEqual(typeof Vexora.Request.input, "function");
  assert.strictEqual(typeof Vexora.Request.ip, "function");

  assert.strictEqual(typeof Vexora.Response.success, "function");
  assert.strictEqual(typeof Vexora.Response.error, "function");
  assert.strictEqual(typeof Vexora.Response.json, "function");
  console.log("   ✅ Config & Request/Response Context passed!\n");

  console.log("==========================================");
  console.log("🎉 ALL VEXORA MASTER PUBLISH CHECKS PASSED 100%!");
  console.log("==========================================\n");

  setTimeout(() => process.exit(0), 100);
}

runFinalPublishVerification();
