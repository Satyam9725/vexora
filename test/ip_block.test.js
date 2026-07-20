import assert from "assert";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running IP Blocking Tests...");

    // Temporarily disable clustering for testing
    const originalCluster = Config.get("SERVER_CLUSTER");
    Config.set("SERVER_CLUSTER", "false");

    // Set blocked IPs configuration
    const originalBlocked = Config.get("BLOCKED_IPS") || "";
    Config.set("BLOCKED_IPS", "127.0.0.1, ::1");

    // Start a temporary Vexora server
    const server = Vexora.Server((req, res) => {
        return res.success({ hello: "world" }, "Accessible");
    });

    await new Promise((resolve) => server.listen(3098, resolve));

    try {
        // Send a request - since the client is localhost (127.0.0.1), it should be blocked and return 403
        const res = await Vexora.http.get("http://localhost:3098/", {
            headers: { "Connection": "close" }
        });
        
        assert.strictEqual(res.status, 403, "Should be blocked with a 403 status code");
        assert.strictEqual(res.data.status, false);
        assert.strictEqual(res.data.message, "Forbidden: Access Denied");

        // Now clear the blocked IP list
        Config.set("BLOCKED_IPS", "");

        // Send request again - it should now succeed
        const res2 = await Vexora.http.get("http://localhost:3098/", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(res2.status, 200, "Should succeed with a 200 status code after unblocking");
        assert.ok(res2.data.status);

        console.log("✅ IP Blocking Tests Passed.\n");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        Config.set("SERVER_CLUSTER", originalCluster);
        Config.set("BLOCKED_IPS", originalBlocked);
    }
}
