import Vexora from "./Vexora.js";

// Start the Vexora server on port 3000
// This auto-connects API controllers, static serving, and security middleware
const app = Vexora.start(3000);

// Configure Static File Serving
app.static("public");

// Enable CORS
app.cors("*");

// Define Routes
app.get("/", (req, res) => {
    return res.success({ status: "healthy", framework: "Vexora Engine" }, "Vexora Server is Running!");
});

app.get("/api/health", (req, res) => {
    return res.json({ uptime: process.uptime(), memory: process.memoryUsage() });
});

console.log("🚀 Server running at http://localhost:3000/");