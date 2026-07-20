import Vexora from "../Vexora.js";

const connectionUrl = Vexora.config.get("MYSQL_DB_URL") || Vexora.config.get("MYSQL_DB_AUTH");
const db = await Vexora.connect(connectionUrl);

try {
  const tables = await db.query("SHOW TABLES");
  console.log("Database Tables:", tables);
} catch (err) {
  console.error("Query failed:", err);
} finally {
  await Vexora.db.disconnect();
}
