import Vexora from "vexora";

// Create static handler mounting the "public" directory with built-in Rate Limiting
const serveStatic = Vexora.static("public", { 
    maxAge: 86400, // maxAge in seconds
    rateLimit: {
        maxRequests: 150,      // Static files are rate-limited to 150 requests/min
        windowSeconds: 60
    }
});

const server = Vexora.Server(async (req, res) => {
    // 1. Serve static files (checks built-in rate limit automatically)
    const served = await serveStatic(req, res);
    if (served) return;

    // 2. Fallback to API routing (automatically checked by global rate limits in config)
    const handled = await Vexora.ApiController(req, res);
    if (handled) return;
});

server.listen(3000, () => {
    console.log("🚀 Vexora Server is running at http://localhost:3000");
});