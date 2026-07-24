const dbKey = "auth";
const id = req.query?.id || 1;
const user = await Vexora.fetch(dbKey, "SELECT * FROM user WHERE id = ?", [id]);
if (!user) return Vexora.Response.error("MySQL User not found!", 404);
return Vexora.Response.success(user, "MySQL user fetched successfully!");
