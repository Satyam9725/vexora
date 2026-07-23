import assert from "node:assert";
import Vexora from "../Vexora.js";

async function runFullDatabaseCheck() {
  console.log("==========================================");
  console.log("🗄️ VEXORA CLI — FULL DATABASE & QUERY ENGINE CHECK");
  console.log("==========================================\n");

  const testTable = "test_cli_users";
  const dbKey = "auth";

  try {
    // 1. CREATE TABLE
    console.log("1️⃣ Creating test table...");
    await Vexora.exec(dbKey, `CREATE TABLE IF NOT EXISTS \`${testTable}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("   ✅ Table created successfully!");

    // Clean old records
    await Vexora.exec(dbKey, `DELETE FROM \`${testTable}\``);

    // 2. INSERT RECORDS
    console.log("\n2️⃣ Inserting records...");
    const id1 = await Vexora.insert(dbKey, testTable, { username: "satyam", email: "satyam@vexora.io", role: "admin" });
    const id2 = await Vexora.insert(dbKey, testTable, { username: "alex", email: "alex@vexora.io", role: "developer" });
    const id3 = await Vexora.insert(dbKey, testTable, { username: "sarah", email: "sarah@vexora.io", role: "user" });
    console.log(`   ✅ Inserted 3 rows (IDs: ${id1}, ${id2}, ${id3})`);

    // 3. FETCH ALL
    console.log("\n3️⃣ Fetching all records...");
    const allUsers = await Vexora.fetchAll(dbKey, `SELECT * FROM \`${testTable}\` ORDER BY id ASC`);
    assert.strictEqual(allUsers.length, 3);
    console.log(`   ✅ fetchAll returned ${allUsers.length} records:`, allUsers.map(u => `${u.id}:${u.username}`));

    // 4. FETCH ONE
    console.log("\n4️⃣ Fetching single record...");
    const user = await Vexora.fetch(dbKey, `SELECT * FROM \`${testTable}\` WHERE username = ?`, ["satyam"]);
    assert.ok(user);
    assert.strictEqual(user.username, "satyam");
    console.log("   ✅ fetch returned record:", user.username, `(${user.email})`);

    // 5. EXISTS CHECK
    console.log("\n5️⃣ Testing exists() check...");
    const existsTrue = await Vexora.exists(dbKey, testTable, "username = ?", ["satyam"]);
    const existsFalse = await Vexora.exists(dbKey, testTable, "username = ?", ["non_existent_user"]);
    assert.strictEqual(existsTrue, true);
    assert.strictEqual(existsFalse, false);
    console.log("   ✅ exists() returned true for existing user, false for non-existing user!");

    // 6. COUNT CHECK
    console.log("\n6️⃣ Testing count() check...");
    const totalCount = await Vexora.count(dbKey, testTable);
    const adminCount = await Vexora.count(dbKey, testTable, "role = ?", ["admin"]);
    assert.strictEqual(totalCount, 3);
    assert.strictEqual(adminCount, 1);
    console.log(`   ✅ count() returned total: ${totalCount}, admin: ${adminCount}`);

    // 7. UPDATE RECORD
    console.log("\n7️⃣ Updating record...");
    const updatedCount = await Vexora.update(dbKey, testTable, { role: "lead_developer", email: "alex_updated@vexora.io" }, "username = ?", ["alex"]);
    assert.strictEqual(updatedCount, 1);
    const updatedUser = await Vexora.fetch(dbKey, `SELECT * FROM \`${testTable}\` WHERE username = ?`, ["alex"]);
    assert.strictEqual(updatedUser.role, "lead_developer");
    console.log("   ✅ update() updated row successfully:", updatedUser.role, updatedUser.email);

    // 8. PAGINATE RECORDS
    console.log("\n8️⃣ Testing pagination...");
    const pageResult = await Vexora.paginate(dbKey, `SELECT * FROM \`${testTable}\``, [], 1, 2);
    assert.strictEqual(pageResult.items.length, 2);
    assert.strictEqual(pageResult.total_items, 3);
    assert.strictEqual(pageResult.total_pages, 2);
    assert.strictEqual(pageResult.has_next, true);
    console.log(`   ✅ paginate() returned page 1 of 2 (${pageResult.items.length} items on page 1)`);

    // 9. DELETE RECORD
    console.log("\n9️⃣ Deleting record...");
    const deletedCount = await Vexora.delete(dbKey, testTable, "username = ?", ["sarah"]);
    assert.strictEqual(deletedCount, 1);
    const postDeleteCount = await Vexora.count(dbKey, testTable);
    assert.strictEqual(postDeleteCount, 2);
    console.log(`   ✅ delete() removed 1 record. Total remaining: ${postDeleteCount}`);

    // 10. CLEANUP TABLE
    console.log("\n🔟 Cleaning up test table...");
    await Vexora.exec(dbKey, `DROP TABLE IF EXISTS \`${testTable}\``);
    console.log("   ✅ Table dropped cleanly!");

    console.log("\n==========================================");
    console.log("🎉 ALL DATABASE CRUD & QUERY OPERATIONS PASSED 100%!");
    console.log("==========================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Database test failed:", err);
    process.exit(1);
  }
}

runFullDatabaseCheck();
