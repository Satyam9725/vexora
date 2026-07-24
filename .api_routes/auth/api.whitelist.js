import Vexora from "vexora";

const apiRouter = new Vexora.RouteController();

// Registered API Endpoints
apiRouter.post('login');
apiRouter.get('login1');
apiRouter.post('login_back');
apiRouter.post('login_id');
apiRouter.put('update_multi');
apiRouter.post('test_fail');
apiRouter.post('forgot');

apiRouter.any('/:any', (req, res) => {
  return res.json({ status: false, message: "Action not found!" }, 404);
});

export default apiRouter;
