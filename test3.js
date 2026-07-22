import Vexora from "vexora";

const app = Vexora.start(3003);

app.static("public2", "home.html", {
  maxAge: 1
});

setTimeout(async () => {
  try {
    const res = await fetch("http://localhost:3003/", {
      headers: { "Accept": "text/html" }
    });
    const text = await res.text();
    console.log(text.substring(0, 500));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}, 1000);
