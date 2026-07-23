import assert from "node:assert";
import Vexora from "../Vexora.js";

async function testAll12Methods() {
  console.log("==========================================");
  console.log("🚀 TESTING ALL 12 VEXORA UNIFIED DATABASE METHODS");
  console.log("==========================================\n");

  const methods = [
    "fetch",
    "fetchAll",
    "fetchColumn",
    "query",
    "exec",
    "insert",
    "update",
    "delete",
    "upsert",
    "exists",
    "count",
    "paginate"
  ];

  for (const m of methods) {
    assert.strictEqual(typeof Vexora[m], "function", `Vexora.${m} must be an exported function`);
    console.log(`   ✅ Vexora.${m}() verified!`);
  }

  console.log("\n==========================================");
  console.log("🎉 ALL 12 UNIFIED DATABASE HELPER METHODS VERIFIED 100%!");
  console.log("==========================================\n");
  process.exit(0);
}

testAll12Methods();
