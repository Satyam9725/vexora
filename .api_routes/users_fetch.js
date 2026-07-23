// API Action Script: Fetch Users using Vexora.fetchAll
const dbKey = "auth";
const users = await Vexora.fetchAll(dbKey, "SELECT * FROM user WHERE status = ?", ["active"]);

return Vexora.Response.success(users, "Users list loaded successfully!");
