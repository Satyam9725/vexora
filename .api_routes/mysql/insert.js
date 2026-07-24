const dbKey = "auth";
const title = req.body?.title || "MySQL User";
const status = req.body?.status || "active";
const newId = await Vexora.insert(dbKey, "user", { title: title, status: status });
return Vexora.Response.success({ id: newId, title: title, status: status }, "MySQL user created successfully!");
