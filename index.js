import Vexora from "vexora";

// 1. Start Vexora Server (Auto-connects API Controllers)
const app = Vexora.start(30000);

// Enable CORS globally for all requests


// 2. Configure static files directory and settings (Required to serve static files)
app.static("public", "home.html", {
    maxAge: 86400,
    rateLimit: {
        maxRequests: 150,
        windowSeconds: 60
    }
});

app.Vexora(any, "/", (req, res) => {
    return res.success({ hello: "world" }, "Welcome to Vexora!");
});

// Example of a POST route:
app.Vexora(post, "/submit", (req, res) => {
    return res.success(req.all(), "Data processed successfully!");
});
