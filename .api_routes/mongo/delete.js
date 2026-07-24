const dbKey = "mongodb";
const id = req.body?.id || 1;
const affected = await Vexora.delete(dbKey, "user", "id = ?", [id]);
return Vexora.Response.success({ id, affected }, "MongoDB user deleted successfully!");
