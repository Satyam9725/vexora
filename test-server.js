import Vexora from "./Vexora.js";

const app = Vexora.start(3001);

app.static("public1", "index.html", {});

setTimeout(async () => {
  try {
const res = await fetch("http://localhost:3001/", {
      headers: { "Accept": "text/html" }
    });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("HEADERS:", res.headers.get("content-type"));
    console.log("BODY_LENGTH:", text.length);
    console.log("BODY_START:", text.substring(0, 50));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}, 1000);
