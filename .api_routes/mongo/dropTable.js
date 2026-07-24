const dbKey = "mongodb";
const table = req.body?.table || "test_table";

const sql = `DROP TABLE IF EXISTS \`${table}\``;
await Vexora.exec(dbKey, sql);
return Vexora.Response.success({ table }, "MongoDB collection deleted successfully!");
