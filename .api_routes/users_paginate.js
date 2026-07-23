// API Action Script: Paginate Users using Vexora.paginate
const dbKey = "auth";
const page = parseInt(req.query?.page) || 1;
const limit = parseInt(req.query?.limit) || 2;

const paginatedResult = await Vexora.paginate(
  dbKey,
  "SELECT * FROM user WHERE status = ?",
  ["active"],
  page,
  limit
);

return Vexora.Response.success(paginatedResult, "Paginated users loaded!");
