import assert from "assert";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running HTTP Client Tests...");

    // Temporarily disable clustering for testing
    const originalCluster = Config.get("SERVER_CLUSTER");
    Config.set("SERVER_CLUSTER", "false");

    // Start a temporary Vexora server to send requests to
    const server = Vexora.Server((req, res) => {
        if (req.method === "GET" && req.path === "/test-get") {
            return res.success({ query: req.query }, "GET response");
        }
        if (req.method === "POST" && req.path === "/test-post") {
            return res.success({ body: req.body }, "POST response");
        }
        if (req.method === "DELETE" && req.path === "/test-delete") {
            return res.success(null, "DELETE response");
        }
    });

    await new Promise((resolve) => server.listen(3099, resolve));

    try {
        // Test GET request
        const getRes = await Vexora.http.get("http://localhost:3099/test-get", {
            headers: { "Connection": "close" },
            query: { name: "satyam" }
        });
        assert.ok(getRes.ok);
        assert.strictEqual(getRes.status, 200);
        assert.strictEqual(getRes.data.data.query.name, "satyam");

        // Test POST request
        const postRes = await Vexora.http.post("http://localhost:3099/test-post", {
            role: "admin"
        }, {
            headers: { "Connection": "close" }
        });
        assert.ok(postRes.ok);
        assert.strictEqual(postRes.status, 200);
        assert.strictEqual(postRes.data.data.body.role, "admin");

        // Test DELETE request
        const deleteRes = await Vexora.http.delete("http://localhost:3099/test-delete", {
            headers: { "Connection": "close" }
        });
        assert.ok(deleteRes.ok);
        assert.strictEqual(deleteRes.status, 200);
        assert.strictEqual(deleteRes.data.message, "DELETE response");

        console.log("✅ HTTP Client Tests Passed.\n");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        Config.set("SERVER_CLUSTER", originalCluster);
    }
}
