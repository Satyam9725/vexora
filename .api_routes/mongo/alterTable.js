const dbKey = "mongodb";
const table = req.body?.table || "test_table";
const action = req.body?.action || "add"; // add, modify, drop
const column = req.body?.column || "new_column";
const type = req.body?.type || "VARCHAR(255)";

let sql = "";
if (action === "add") {
  sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`;
} else if (action === "modify") {
  sql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${type}`;
} else if (action === "drop") {
  sql = `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``;
} else {
  return Vexora.Response.error("Invalid action! Use: add, modify, or drop", 400);
}

await Vexora.exec(dbKey, sql);
return Vexora.Response.success({ table, action, column, type }, "MongoDB collection updated successfully!");
