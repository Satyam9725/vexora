const dbKey = "mongodb";
const id = req.query?.id || 1;
const user = await Vexora.fetch(dbKey, "SELECT * FROM user WHERE id = ?", [id]);
if (!user) return Vexora.Response.error("MongoDB User not found!", 404);
return Vexora.Response.success(user, "MongoDB user fetched successfully!");
