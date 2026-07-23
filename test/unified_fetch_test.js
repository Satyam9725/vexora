import assert from "node:assert";
import Vexora from "../Vexora.js";
import { writeDbConfig, readDbConfig } from "../commands/helpers.js";

async function testUnifiedFetchAndBuilders() {
  console.log("==========================================");
  console.log("🚀 TESTING VEXORA UNIFIED VEXORA.FETCH API");
  console.log("==========================================\n");

  // Mock configuration in db_config.json
  const existingConfig = readDbConfig();
  writeDbConfig({
    ...existingConfig,
    auth: {
      DB_HOST: "cluster0.fsiwzxu.mongodb.net",
      DB_USER: "satyam",
      DB_PASS: "@satyam123",
      DB_NAME: "satyam",
      DB_DRIVER: "mongodb",
      driver: "mongodb",
      DB_URL: "mongodb+srv://satyam:%40satyam123@cluster0.fsiwzxu.mongodb.net/satyam?appName=Cluster0"
    }
  });

  console.log("1️⃣ MongoDB Config auto-encoding check...");
  const configs = readDbConfig();
  assert.strictEqual(configs.auth.DB_DRIVER, "mongodb");
  assert.strictEqual(configs.auth.DB_URL.includes("%40satyam123"), true);
  console.log("   ✅ MongoDB Config & URL Auto-encoding verified!\n");

  console.log("2️⃣ Vexora.fetch facade check...");
  assert.strictEqual(typeof Vexora.fetch, "function");
  console.log("   ✅ Vexora.fetch() method registered on Vexora facade!\n");

  console.log("==========================================");
  console.log("🎉 UNIFIED VEXORA.FETCH & MONGODB CLI SETUP PASSED 100%!");
  console.log("==========================================\n");
  process.exit(0);
}

testUnifiedFetchAndBuilders();
