// API Action Script: Create User using Vexora.insert
const dbKey = "auth";
const title = req.body?.title || "New Developer";
const status = req.body?.status || "active";

const newId = await Vexora.insert(dbKey, "user", {
  title: title,
  status: status
});

return Vexora.Response.success({ id: newId, title, status }, "User created successfully!");
