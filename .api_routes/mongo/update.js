const dbKey = "mongodb";
const id = req.body?.id || 1;
const title = req.body?.title || "MongoDB Updated User";
const affected = await Vexora.update(dbKey, "user", { title: title }, "id = ?", [id]);
return Vexora.Response.success({ id, title, affected }, "MongoDB user updated successfully!");
