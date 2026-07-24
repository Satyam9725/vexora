import Vexora from "vexora";

const mysqlRouter = new Vexora.RouteController();

mysqlRouter.post("insert");
mysqlRouter.put("update");
mysqlRouter.delete("delete");
mysqlRouter.get("fetch");
mysqlRouter.get("fetchAll");
mysqlRouter.get("fetchAllWhere");
mysqlRouter.get("exists");
mysqlRouter.get("paginate");
mysqlRouter.any("run");
mysqlRouter.post("createTable");
mysqlRouter.put("alterTable");
mysqlRouter.delete("dropTable");

export default mysqlRouter;
