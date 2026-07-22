import Vexora from "vexora";

// Create a RouteController to act as a whitelist and router
const apiRouter = new Vexora.RouteController();

// Map HTTP methods to specific controller script files
// apiRouter.get('endpoint'); // → .api_routes/admin/endpoint.js

// Catch-all routing handler for undefined API routes
apiRouter.any('/:any', (req, res) => {
    return res.json({ status: false, message: "Action not found!" }, 404);
});

export default apiRouter;
