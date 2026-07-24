import Vexora from "vexora";

const mongoRouter = new Vexora.RouteController();

mongoRouter.post("insert");
mongoRouter.put("update");
mongoRouter.delete("delete");
mongoRouter.get("fetch");
mongoRouter.get("fetchAll");
mongoRouter.get("fetchAllWhere");
mongoRouter.get("exists");
mongoRouter.get("paginate");
mongoRouter.any("run");
mongoRouter.post("createTable");
mongoRouter.put("alterTable");
mongoRouter.delete("dropTable");

export default mongoRouter;
