import Vexora from "vexora";

const apiRouter = new Vexora.RouteController();

// Registered whitelisted API routes for live testing
apiRouter.any('get_any');
apiRouter.post('get_post');
apiRouter.get('users_fetch');
apiRouter.post('user_create');
apiRouter.put('user_update');
apiRouter.delete('user_delete');
apiRouter.get('user_exists');
apiRouter.get('users_paginate');
apiRouter.post('sql_vulnerable');

export default apiRouter;
