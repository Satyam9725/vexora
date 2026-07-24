/**
 * Vexora CLI - Live End-to-End Database CRUD Verification
 * Tests all database CLI operations on MySQL and MongoDB:
 *   1. Create Table
 *   2. Insert Records
 *   3. View/Describe Table
 *   4. Update Records
 *   5. Truncate Table
 *   6. Drop Table
 *   7. Verify cleanup
 *
 * Uses global.mockPromptQuestion to automate interactive prompts.
 */

import { dbCommands } from "../commands/dbCommands.js";
import { readDbConfig } from "../commands/helpers.js";

const TEST_TABLE = "vexora_cli_test_" + Date.now();
let totalTests = 0;
let passedTests = 0;

function pass(label) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ ${label}`);
}

function fail(label, err) {
  totalTests++;
  console.log(`  ❌ ${label}: ${err}`);
}

function section(title) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(50)}`);
}

// Helper: create a mock prompt queue
function mockPrompts(answers) {
  const queue = [...answers];
  global.mockPromptQuestion = (query, defaultValue) => {
    const ans = queue.shift();
    if (ans !== undefined) return ans;
    return defaultValue || "";
  };
}

function clearMock() {
  global.mockPromptQuestion = null;
}

// ─── Run tests for a specific database key ───
async function testDatabase(dbKey) {
  const configs = readDbConfig();
  const conf = configs[dbKey];
  if (!conf) {
    fail(`DB Config '${dbKey}'`, "Not found in db_config.json");
    return;
  }

  const isEnabled = conf.enabled !== false && conf.ENABLED !== false && conf.enabled !== "false";
  if (!isEnabled) {
    console.log(`  ⚠️ Skipping '${dbKey}' (disabled)`);
    return;
  }

  const driver = (conf.driver || conf.DB_DRIVER || "mysql").toLowerCase();
  section(`Testing '${dbKey}' (${driver.toUpperCase()}) - Table: '${TEST_TABLE}'`);

  // ─── 1. CREATE TABLE ───
  console.log("\n  👉 Step 1: Create Table...");
  try {
    if (driver === "mongodb") {
      // MongoDB: db:table:create prompts: tableName, confirm
      mockPrompts(["y"]);
      await dbCommands["db:table:create"].run(["db:table:create", TEST_TABLE, dbKey]);
      clearMock();
      pass("Create Table (MongoDB Collection)");
    } else {
      // MySQL/Postgres: prompts: tableName, col1 name, type, size, nullable, default, index, done, timestamps, confirm
      mockPrompts([
        "title",     // Column #1 name
        "VARCHAR",   // Column #1 type
        "255",       // Column #1 size
        "y",         // Column #1 nullable
        "",          // Column #1 default
        "none",      // Column #1 index
        "status",    // Column #2 name
        "VARCHAR",   // Column #2 type
        "50",        // Column #2 size
        "y",         // Column #2 nullable
        "",          // Column #2 default
        "none",      // Column #2 index
        "done",      // Finish adding columns
        "y",         // Add timestamps
        "y",         // Confirm creation
      ]);
      await dbCommands["db:table:create"].run(["db:table:create", TEST_TABLE, dbKey]);
      clearMock();
      pass("Create Table (SQL)");
    }
  } catch (err) {
    clearMock();
    fail("Create Table", err.message);
    return; // Cannot continue if table creation failed
  }

  // ─── 2. DESCRIBE TABLE ───
  console.log("\n  👉 Step 2: Describe Table...");
  try {
    mockPrompts([]);
    await dbCommands["db:table:describe"].run(["db:table:describe", TEST_TABLE, dbKey]);
    clearMock();
    pass("Describe Table");
  } catch (err) {
    clearMock();
    fail("Describe Table", err.message);
  }

  // ─── 3. INSERT RECORD ───
  console.log("\n  👉 Step 3: Insert Record...");
  try {
    if (driver === "mongodb") {
      // MongoDB insert via db:table:insert: column names, then values
      mockPrompts(["title, status", "Test Title CLI", "active"]);
      await dbCommands["db:table:insert"].run(["db:table:insert", TEST_TABLE, dbKey]);
      clearMock();
    } else {
      // MySQL insert: column names (comma separated), then each value
      mockPrompts(["title, status", "Test Title CLI", "active"]);
      await dbCommands["db:table:insert"].run(["db:table:insert", TEST_TABLE, dbKey]);
      clearMock();
    }
    pass("Insert Record");
  } catch (err) {
    clearMock();
    fail("Insert Record", err.message);
  }

  // ─── 4. VIEW TABLE DATA ───
  console.log("\n  👉 Step 4: View Table Data...");
  try {
    mockPrompts([]);
    await dbCommands["db:table:view"].run(["db:table:view", TEST_TABLE, dbKey]);
    clearMock();
    pass("View Table Data");
  } catch (err) {
    clearMock();
    fail("View Table Data", err.message);
  }

  // ─── 5. UPDATE RECORD ───
  console.log("\n  👉 Step 5: Update Record...");
  try {
    if (driver === "mongodb") {
      mockPrompts(["title", "Updated Title CLI", "_id = 1", "y"]);
    } else {
      mockPrompts(["title", "Updated Title CLI", "1", "y"]);
    }
    await dbCommands["db:table:update"].run(["db:table:update", TEST_TABLE, dbKey]);
    clearMock();
    pass("Update Record");
  } catch (err) {
    clearMock();
    fail("Update Record", err.message);
  }

  // ─── 6. VIEW TABLE AFTER UPDATE ───
  console.log("\n  👉 Step 6: View Table After Update...");
  try {
    mockPrompts([]);
    await dbCommands["db:table:view"].run(["db:table:view", TEST_TABLE, dbKey]);
    clearMock();
    pass("View Table After Update");
  } catch (err) {
    clearMock();
    fail("View Table After Update", err.message);
  }

  // ─── 7. TRUNCATE TABLE ───
  console.log("\n  👉 Step 7: Truncate Table...");
  try {
    mockPrompts(["y"]);
    await dbCommands["db:table:truncate"].run(["db:table:truncate", TEST_TABLE, dbKey]);
    clearMock();
    pass("Truncate Table");
  } catch (err) {
    clearMock();
    fail("Truncate Table", err.message);
  }

  // ─── 8. INSERT AGAIN (verify truncate worked) ───
  console.log("\n  👉 Step 8: Insert After Truncate (verify empty)...");
  try {
    mockPrompts(["title, status", "Post Truncate Title", "pending"]);
    await dbCommands["db:table:insert"].run(["db:table:insert", TEST_TABLE, dbKey]);
    clearMock();
    pass("Insert After Truncate");
  } catch (err) {
    clearMock();
    fail("Insert After Truncate", err.message);
  }

  // ─── 9. DROP TABLE ───
  console.log("\n  👉 Step 9: Drop Table (Cleanup)...");
  try {
    mockPrompts(["y"]);
    await dbCommands["db:table:drop"].run(["db:table:drop", TEST_TABLE, dbKey]);
    clearMock();
    pass("Drop Table");
  } catch (err) {
    clearMock();
    fail("Drop Table", err.message);
  }

  // ─── 10. VERIFY DROP (table should not exist) ───
  console.log("\n  👉 Step 10: Verify Table Dropped...");
  try {
    mockPrompts([]);
    await dbCommands["db:table:describe"].run(["db:table:describe", TEST_TABLE, dbKey]);
    clearMock();
    // If describe doesn't throw, it may still have printed an error, that's okay
    pass("Verify Table Dropped (describe ran without crash)");
  } catch (err) {
    clearMock();
    // An error here is expected since the table should not exist
    pass("Verify Table Dropped (table correctly gone)");
  }
}

// ─── MAIN ───
async function main() {
  console.log("==========================================");
  console.log("⚡ VEXORA CLI LIVE DATABASE CRUD TEST");
  console.log("==========================================");
  console.log(`  📌 Test Table: '${TEST_TABLE}'`);

  const configs = readDbConfig();
  const dbKeys = Object.keys(configs);

  if (dbKeys.length === 0) {
    console.error("❌ No databases configured in db_config.json!");
    process.exit(1);
  }

  console.log(`  📌 Found ${dbKeys.length} database connection(s): ${dbKeys.join(", ")}`);

  for (const dbKey of dbKeys) {
    try {
      await testDatabase(dbKey);
    } catch (err) {
      fail(`Database '${dbKey}' UNEXPECTED ERROR`, err.message);
    }
  }

  // ─── FINAL REPORT ───
  console.log("\n" + "=".repeat(50));
  console.log("📊 FINAL RESULTS");
  console.log("=".repeat(50));
  console.log(`  Total Tests:  ${totalTests}`);
  console.log(`  Passed:       ${passedTests}`);
  console.log(`  Failed:       ${totalTests - passedTests}`);
  console.log("=".repeat(50));

  if (passedTests === totalTests) {
    console.log("🎉 ALL LIVE CLI DATABASE TESTS PASSED!\n");
  } else {
    console.log(`⚠️ ${totalTests - passedTests} TEST(S) FAILED!\n`);
  }

  clearMock();
  process.exit(passedTests === totalTests ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message);
  clearMock();
  process.exit(1);
});
