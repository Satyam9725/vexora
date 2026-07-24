const dbKey = "auth";
const title = req.query?.title || "";
const exists = await Vexora.exists(dbKey, "user", "title = ?", [title]);
return Vexora.Response.success({ title, exists }, "MySQL user existence checked successfully!");
