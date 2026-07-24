const dbKey = "mongodb";
const users = await Vexora.fetchAll(dbKey, "SELECT * FROM user");
return Vexora.Response.success(users, "MongoDB users fetched successfully!");
