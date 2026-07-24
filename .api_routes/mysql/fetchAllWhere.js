const dbKey = "auth";
const status = req.query?.status || "active";
const users = await Vexora.fetchAll(dbKey, "SELECT * FROM user WHERE status = ?", [status]);
return Vexora.Response.success(users, "MySQL users fetched with WHERE successfully!");
