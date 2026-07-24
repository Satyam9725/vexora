// API Action Script: MongoDB Run Batch Test
const dbKey = "mongodb";

// 1. Clean table
await Vexora.exec(dbKey, "DELETE FROM user");

// 2. Insert 50 rows
const insertedIds = [];
for (let i = 1; i <= 50; i++) {
  const newId = await Vexora.insert(dbKey, "user", {
    title: `MongoDB User #${i}`,
    status: "active"
  });
  insertedIds.push(newId);
}

// 3. Update 10 users
let updatedCount = 0;
for (let i = 0; i < 10; i++) {
  const targetId = insertedIds[i];
  const affected = await Vexora.update(
    dbKey,
    "user",
    { status: "updated" },
    "id = ?",
    [targetId]
  );
  updatedCount += affected;
}

// 4. Delete 10 users
let deletedCount = 0;
for (let i = 10; i < 20; i++) {
  const targetId = insertedIds[i];
  const affected = await Vexora.delete(
    dbKey,
    "user",
    "id = ?",
    [targetId]
  );
  deletedCount += affected;
}

// 5. Query final state
const currentUsers = await Vexora.fetchAll(dbKey, "SELECT * FROM user");

return Vexora.Response.success({
  db: "mongodb",
  inserted: insertedIds.length,
  updated: updatedCount,
  deleted: deletedCount,
  remaining: currentUsers.length,
  items: currentUsers.slice(0, 5) // return first 5 as a sample
}, "MongoDB Batch operations executed successfully!");
