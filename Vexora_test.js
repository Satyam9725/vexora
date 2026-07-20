import Vexora from "vexora";

const INDEX_RESPONSE = JSON.stringify({
    status: true,
    message: "Welcome to Vexora!",
    data: { hello: "world" }
});
const INDEX_RESPONSE_LEN = Buffer.byteLength(INDEX_RESPONSE);

const BENCH_RESPONSE = JSON.stringify({
    status: true
});
const BENCH_RESPONSE_LEN = Buffer.byteLength(BENCH_RESPONSE);

// Start Vexora Server
const server = Vexora.Server((req, res) => {
    // 2. Dynamic route router mapping
    return Vexora.ApiController(req, res);
}, {
    fastPaths: {
        "GET:/": INDEX_RESPONSE,
        "GET:/bench": BENCH_RESPONSE
    }
});

server.listen(3002, () => {
    console.log("🚀 Vexora Framework Server is running at http://localhost:3002");
});