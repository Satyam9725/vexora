import Vexora from "./Vexora.js";

// Start Vexora Server (Auto-connects static serving and API controllers)
const app = Vexora.start(3000);

// Define custom routes directly using app
app.get("/", (req, res) => {
    return res.success({ hello: "world" }, "Vexora Server is Running!");
});
