// API Action Script: Check User Existence using Vexora.exists
const dbKey = "auth";
const checkTitle = req.query?.title || "VExora";

const userExists = await Vexora.exists(dbKey, "user", "title = ?", [checkTitle]);

return Vexora.Response.success({ title: checkTitle, exists: userExists }, "Existence check completed!");
