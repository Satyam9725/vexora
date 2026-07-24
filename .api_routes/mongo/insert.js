const dbKey = "mongodb";
const title = req.body?.title || "MongoDB User";
const status = req.body?.status || "active";
const newId = await Vexora.insert(dbKey, "user", { title: title, status: status });
return Vexora.Response.success({ id: newId, title: title, status: status }, "MongoDB user created successfully!");
