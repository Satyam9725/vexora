import Vexora from "./Vexora.js";

const app = Vexora.start(3002);

app.static("public", "index.html", {});

console.log("Vexora is running! Open http://localhost:3002/ in your browser.");
