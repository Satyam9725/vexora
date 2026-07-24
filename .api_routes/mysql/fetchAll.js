const dbKey = "auth";
const users = await Vexora.fetchAll(dbKey, "SELECT * FROM user");
return Vexora.Response.success(users, "MySQL users fetched successfully!");
