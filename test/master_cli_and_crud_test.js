import assert from "node:assert";
import Vexora from "../Vexora.js";
import executeCommand from "../command.js";
import { isAuthenticated, clearAuthSession, getAuthFilePath } from "../commands/authCommands.js";
import fs from "node:fs";

async function runMasterCliAndCrudTest() {
  console.log("==========================================");
  console.log("🚀 VEXORA FULL MASTER CLI & API CRUD TEST");
  console.log("==========================================\n");

  // ── TEST 1: Unauthenticated CLI Guard ─────────────────────────
  console.log("1️⃣ Testing Unauthenticated CLI Protection...");
  clearAuthSession();
  assert.strictEqual(isAuthenticated(), false);
  console.log("   ✅ Unauthenticated state verified!\n");

  // ── TEST 2: Protected Command Rejection ────────────────────────
  console.log("2️⃣ Testing Protected Command Access Block...");
  let exitStatus = null;
  const originalExit = process.exit;
  process.exit = (code) => { exitStatus = code; };

  await executeCommand(["security:cipher:reset"]);
  process.exit = originalExit;

  assert.strictEqual(exitStatus, 1, "Unauthenticated command execution should be rejected");
  console.log("   ✅ Protected command blocked when unauthenticated!\n");

  // ── TEST 3: Chained Login & Diagnostic Commands ──────────────
  console.log("3️⃣ Testing Chained Single-Command Login & CLI Features...");
  await executeCommand(["login", "info", "--no-interactive"]);
  console.log("   ✅ Chained Single-Command Login executed successfully!\n");

  // ── TEST 4: Ephemeral One-Time Session Clean Cleanup ─────────────
  console.log("4️⃣ Testing One-Time Session Cleanup after Command Return...");
  assert.strictEqual(fs.existsSync(getAuthFilePath()), false, "Auth session must be cleaned up on shell return");
  console.log("   ✅ One-time session auto-logout verified!\n");

  // ── TEST 5: Vexora Native Routing & HTTP Client Live CRUD ────────
  console.log("5️⃣ Testing Native Routing (app.Vexora) & Live HTTP CRUD...");
  
  const testPort = 9977;
  const testApp = Vexora.start(testPort);

  testApp.Vexora("GET", "/api/test_info", (req, res) => {
    return res.success({ version: "1.5.4", status: "online" });
  });

  testApp.Vexora("POST", "/api/test_create", (req, res) => {
    return res.success(req.body, "Created!");
  });

  testApp.Vexora("PUT", "/api/test_update", (req, res) => {
    return res.success({ updated: true, ...req.body });
  });

  testApp.Vexora("DELETE", "/api/test_delete", (req, res) => {
    return res.success({ deleted: true });
  });

  await new Promise((r) => setTimeout(r, 200));

  // HTTP GET
  const getRes = await Vexora.http.get(`http://127.0.0.1:${testPort}/api/test_info`);
  assert.strictEqual(getRes.ok, true);
  assert.ok(getRes.data);
  console.log("   ✅ GET Request passed!");

  // HTTP POST
  const postRes = await Vexora.http.post(`http://127.0.0.1:${testPort}/api/test_create`, { name: "Satyam Kumar", role: "admin" });
  assert.strictEqual(postRes.ok, true);
  assert.ok(postRes.data);
  console.log("   ✅ POST Request passed!");

  // HTTP PUT
  const putRes = await Vexora.http.put(`http://127.0.0.1:${testPort}/api/test_update`, { role: "lead_developer" });
  assert.strictEqual(putRes.ok, true);
  assert.ok(putRes.data);
  console.log("   ✅ PUT Request passed!");

  // HTTP DELETE
  const delRes = await Vexora.http.delete(`http://127.0.0.1:${testPort}/api/test_delete`);
  assert.strictEqual(delRes.ok, true);
  assert.ok(delRes.data);
  console.log("   ✅ DELETE Request passed!\n");

  testApp.close();

  // ── TEST 6: All 12 Database Helper Facade Methods ─────────────────
  console.log("6️⃣ Testing All 12 Unified Database Facade Methods...");
  const dbMethods = [
    "fetch", "fetchAll", "fetchColumn", "query", "exec",
    "insert", "update", "delete", "upsert", "exists", "count", "paginate"
  ];
  for (const m of dbMethods) {
    assert.strictEqual(typeof Vexora[m], "function", `Vexora.${m} must be an exported function`);
  }
  console.log("   ✅ All 12 Database Methods (fetch, insert, update, count, etc.) verified!\n");

  // ── TEST 7: Dynamic Polymorphic Encryption & Password Hashing ───
  console.log("7️⃣ Testing Cryptographic Engines ($2y$ Bcrypt & Polymorphic Crypt)...");
  
  const hash = Vexora.password_hash("rasmuslerdorf", 10);
  assert.ok(hash.startsWith("$2y$10$"));
  assert.strictEqual(Vexora.password_verify("rasmuslerdorf", hash), true);
  console.log("   ✅ PHP $2y$ Bcrypt Hashing passed!");

  const cipher = Vexora.Crypt.encrypt({ payload: "SecretData" }, "customSecret");
  const decrypted = Vexora.Crypt.decrypt(cipher, "customSecret");
  assert.strictEqual(decrypted.payload, "SecretData");
  console.log("   ✅ Dynamic Polymorphic 6-Layer Encryption passed!\n");

  console.log("==========================================");
  console.log("🎉 ALL VEXORA MASTER CLI & API CRUD TESTS PASSED 100%!");
  console.log("==========================================\n");
  process.exit(0);
}

runMasterCliAndCrudTest();
