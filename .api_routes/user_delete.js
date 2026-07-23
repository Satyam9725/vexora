// API Action Script: Delete User using Vexora.delete
const dbKey = "auth";
const userId = req.body?.id || 999;

const deletedCount = await Vexora.delete(dbKey, "user", "id = ?", [userId]);

return Vexora.Response.success({ deleted: deletedCount, id: userId }, "User deleted successfully!");
