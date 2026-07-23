import assert from "node:assert";
import Vexora from "../Vexora.js";
import { writeDbConfig, readDbConfig } from "../commands/helpers.js";

async function testDbEnabledToggle() {
  console.log("==========================================");
  console.log("🚀 TESTING DATABASE ENABLED: FALSE TOGGLE");
  console.log("==========================================\n");

  const existingConfig = readDbConfig();
  
  // Set disabled database connection "offlineDb"
  writeDbConfig({
    ...existingConfig,
    offlineDb: {
      enabled: false,
      DB_HOST: "localhost",
      DB_USER: "root",
      DB_PASS: "",
      DB_NAME: "disabled_db",
      DB_DRIVER: "mysql"
    }
  });

  console.log("1️⃣ Testing query execution on disabled database...");
  let blockedError = null;
  try {
    await Vexora.fetch("offlineDb", "SELECT * FROM users");
  } catch (err) {
    blockedError = err.message;
  }

  assert.ok(blockedError, "Disabled DB call must throw error");
  assert.strictEqual(blockedError.includes("turned OFF"), true, "Error message must state database is turned OFF");
  console.log(`   ✅ Query blocked successfully: "${blockedError}"\n`);

  console.log("==========================================");
  console.log("🎉 DATABASE ENABLED TOGGLE TEST PASSED 100%!");
  console.log("==========================================\n");
  process.exit(0);
}

testDbEnabledToggle();
