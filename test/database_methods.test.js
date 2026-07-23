import assert from "node:assert";
import Vexora from "../Vexora.js";
import MySqlQueryBuilder from "../database/QueryBuilder/MySqlQueryBuilder.js";
import BaseQueryBuilder from "../database/QueryBuilder/BaseQueryBuilder.js";

export async function run() {
  console.log("🧪 Testing Database Methods & Signature Parsing...");

  const qb = new MySqlQueryBuilder();

  // Mock mysql execute and query for QueryBuilder offline verification
  const mysqlModule = (await import("../database/mysql.js")).default;
  const origExecute = mysqlModule.execute;
  const origQuery = mysqlModule.query;

  let executedSql = "";
  let executedParams = [];

  mysqlModule.execute = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return { affectedRows: 1, insertId: 10 };
  };

  mysqlModule.query = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return [{ id: 1, name: "Test User" }];
  };

  try {
    // 1. Test update with (dbKey, table, data, where, params)
    await qb.update("auth", "user", { name: "John" }, "id = ?", [1]);
    assert.strictEqual(executedSql, "UPDATE `user` SET `name` = ? WHERE id = ?");
    assert.deepStrictEqual(executedParams, ["John", 1]);
    console.log("  ✓ update with 5 args (dbKey) works");

    // 2. Test update with (table, data, where, params)
    await qb.update("user", { name: "Jane" }, "id = ?", [2]);
    assert.strictEqual(executedSql, "UPDATE `user` SET `name` = ? WHERE id = ?");
    assert.deepStrictEqual(executedParams, ["Jane", 2]);
    console.log("  ✓ update with 4 args (no dbKey) works");

    // 3. Test delete with (dbKey, table, where, params)
    await qb.delete("auth", "user", "id = ?", [5]);
    assert.strictEqual(executedSql, "DELETE FROM `user` WHERE id = ?");
    assert.deepStrictEqual(executedParams, [5]);
    console.log("  ✓ delete with 4 args (dbKey) works");

    // 4. Test delete with (table, where, params)
    await qb.delete("user", "id = ?", [6]);
    assert.strictEqual(executedSql, "DELETE FROM `user` WHERE id = ?");
    assert.deepStrictEqual(executedParams, [6]);
    console.log("  ✓ delete with 3 args (no dbKey) works");

    // 5. Test insert with (dbKey, table, data)
    await qb.insert("auth", "user", { name: "Bob" });
    assert.strictEqual(executedSql, "INSERT INTO `user` (`name`) VALUES (?)");
    assert.deepStrictEqual(executedParams, ["Bob"]);
    console.log("  ✓ insert with 3 args (dbKey) works");

    // 6. Test insert with (table, data)
    await qb.insert("user", { name: "Alice" });
    assert.strictEqual(executedSql, "INSERT INTO `user` (`name`) VALUES (?)");
    assert.deepStrictEqual(executedParams, ["Alice"]);
    console.log("  ✓ insert with 2 args (no dbKey) works");

    // 7. Test exists with (dbKey, table, where, params)
    const existsRes1 = await qb.exists("auth", "user", "id = ?", ["4q"]);
    assert.strictEqual(executedSql, "SELECT 1 FROM `user` WHERE id = ? LIMIT 1");
    assert.deepStrictEqual(executedParams, ["4q"]);
    assert.strictEqual(existsRes1, true);
    console.log("  ✓ exists with 4 args works");

    // 8. Test exists with (table, where, params)
    const existsRes2 = await qb.exists("user", "id = ?", ["non_existent"]);
    assert.strictEqual(executedSql, "SELECT 1 FROM `user` WHERE id = ? LIMIT 1");
    assert.deepStrictEqual(executedParams, ["non_existent"]);
    assert.strictEqual(existsRes2, true);
    console.log("  ✓ exists with 3 args works");

    // 9. Test count with (table, where, params)
    await qb.count("user", "status = ?", ["active"]);
    assert.strictEqual(executedSql, "SELECT COUNT(*) AS total FROM `user` WHERE status = ?");
    assert.deepStrictEqual(executedParams, ["active"]);
    console.log("  ✓ count works");

    console.log("✅ All Database Method Tests Passed Successfully!\n");
  } finally {
    mysqlModule.execute = origExecute;
    mysqlModule.query = origQuery;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
