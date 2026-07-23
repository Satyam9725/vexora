import Vexora from "./Vexora.js";

// Start Vexora Server
const app = Vexora.start(3000);

// Vexora-native routing syntax: app.Vexora(method, uri, handler)
app.Vexora("GET", "/", (req, res) => {
    return res.success({ hello: "world" }, "Vexora Server is Running!");
});
