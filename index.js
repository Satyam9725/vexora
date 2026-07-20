import Vexora from "vexora";

// Create static handler mounting the "public" directory
const serveStatic = Vexora.static("public", { maxAge: 86400 }); // maxAge in seconds

const server = Vexora.Server(async (req, res) => {
    // 1. Serve static files
    const served = await serveStatic(req, res);
    if (served) return;

    // 2. Fallback to API routing...
    const handled = await Vexora.ApiController(req, res);
    if (handled) return;
});

server.listen(3000);