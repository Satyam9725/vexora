import Vexora from "vexora";

// Create a RouteController to act as a whitelist and router
const apiRouter = new Vexora.RouteController();

// 1. Ye api self folder (.api_routes) se kam kare:
// iska url kuchh aisa banega:
// http://localhost:3000/api/get_any
apiRouter.any('get_any');  

// http://localhost:3000/api/get_post
apiRouter.post('get_post');  

// http://localhost:3000/api/get


// 2. Automapped Sub-routers:
// Vexora automatic sub-routers support karta hai. 
// Aapko is main file mein custom subfolder ke URLs ko map karne ki zarurat nahi hai.
// Aap bas subfolder (jaise '.api_routes/admin/api.whitelist.js') banayein aur usme files ko whitelist karein.
// Vexora wahan ki files ko apne aap subfolder path (/api/admin/...) ke sath map kar dega.


// Root API handler (so you don't need an index.js file for /api)

export default apiRouter;
