import Vexora from "vexora";

let count = 0;
Vexora.Schedule("1", async () => {
    count++;
    console.log("Runs every 300 seconds (5 minutes)", count);
});

// C. Start Vexora Server (Auto-connects API controllers)
const app = Vexora.start(3000);

app.get("/", (req, res) => {
    return res.success({ hello: "world" }, "Vexora Scheduler Active");
});