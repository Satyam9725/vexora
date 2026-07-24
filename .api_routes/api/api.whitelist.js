import Vexora from "vexora";

const apiRouter = new Vexora.RouteController();

// Registered API Endpoints
apiRouter.post('login');

apiRouter.any('/:any', (req, res) => {
  return res.json({ status: false, message: "Action not found!" }, 404);
});

export default apiRouter;
