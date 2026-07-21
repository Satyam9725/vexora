import Vexora from "vexora";

// 1. Start Vexora Server (Auto-connects API Controllers)
const app = Vexora.start(30000);

// Routing Precedence Rules:
// 1. Static Files (public/): Highest Precedence. If public/index.html exists at the '/' path, it will load first.
// 2. API Controllers (.Vexora_Api/): Second Precedence.
// 3. Custom Routes (app.Vexora): Lowest Precedence (served as fallback).

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
