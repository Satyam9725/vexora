const dbKey = "mongodb";
const page = parseInt(req.query?.page) || 1;
const limit = parseInt(req.query?.limit) || 10;
const result = await Vexora.paginate(dbKey, "SELECT * FROM user", [], page, limit);
return Vexora.Response.success(result, "MongoDB users paginated successfully!");
