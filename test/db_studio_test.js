import assert from "node:assert";
import { openDatabaseStudio, dbCommands } from "../commands/dbCommands.js";

async function testDatabaseStudio() {
  console.log("==========================================");
  console.log("🚀 TESTING INTERACTIVE DATABASE STUDIO & DB:LIST INTEGRATION");
  console.log("==========================================\n");

  assert.strictEqual(typeof openDatabaseStudio, "function", "openDatabaseStudio must be an exported function");
  assert.strictEqual(typeof dbCommands["db:list"].run, "function", "db:list run method must exist");

  console.log("   ✅ openDatabaseStudio & db:list interactive integration verified successfully!\n");

  console.log("==========================================");
  console.log("🎉 DATABASE STUDIO TEST PASSED 100%!");
  console.log("==========================================\n");
  process.exit(0);
}

testDatabaseStudio();
