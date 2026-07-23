// API Action Script: Update User using Vexora.update
const dbKey = "auth";
const userId = req.body?.id || 1;
const title = req.body?.title || "Updated Title";

const affectedRows = await Vexora.update(
  dbKey,
  "user",
  { title: title },
  "id = ?",
  [userId]
);

return Vexora.Response.success({ affected_rows: affectedRows, id: userId, title }, "User updated successfully!");
