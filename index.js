import Vexora from "vexora";

const app = Vexora.start(3000);

// Configure static file serving
app.static("public", "home.html", {
    maxAge: 86400,
    rateLimit: {
        maxRequests: 150,
        windowSeconds: 60
    }
});

// Bind WebSocket engine to the HTTP server
const io = Vexora.WebSocket(app);
console.log("🌐 Vexora WebSocket Engine is running!");

io.on("connection", (socket) => {
  console.log("🔌 Client connected!");

  // Send to this client
  socket.send({ type: "welcome", message: "Connected to Vexora!" });

  // Listen for messages
  socket.on("message", (msg) => {
    console.log("Received:", msg);

    // Broadcast to all OTHER clients (excluding sender)
    socket.broadcast(msg);

    // Broadcast to EVERYONE (including sender)
    // io.broadcast(msg);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected");
  });
});
