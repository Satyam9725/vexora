// API Action Script: Secure Query
const userId = req.body?.id || 1;
const result = await Vexora.query("auth", "SELECT * FROM user WHERE id = ?", [userId]);
return Vexora.Response.success(result);
