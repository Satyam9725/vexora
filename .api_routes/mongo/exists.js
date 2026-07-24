const dbKey = "mongodb";
const title = req.query?.title || "";
const exists = await Vexora.exists(dbKey, "user", "title = ?", [title]);
return Vexora.Response.success({ title, exists }, "MongoDB user existence checked successfully!");
