import Vexora from "vexora";

const app = Vexora.start(3004);

app.static("public2", "home.html", {
  maxAge: 1
});
