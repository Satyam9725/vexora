const dbKey = "auth";
const table = req.body?.table || "test_table";
const columns = req.body?.columns || {
  id: "INT AUTO_INCREMENT PRIMARY KEY",
  title: "VARCHAR(255) NOT NULL",
  status: "VARCHAR(50) DEFAULT 'active'",
  created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
};

const colDefs = Object.entries(columns).map(([name, type]) => `\`${name}\` ${type}`).join(", ");
const sql = `CREATE TABLE IF NOT EXISTS \`${table}\` (${colDefs})`;

await Vexora.exec(dbKey, sql);
return Vexora.Response.success({ table, columns }, "MySQL table created successfully!");
