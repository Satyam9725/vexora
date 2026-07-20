import assert from "assert";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running Suspicious Behavior Blocking Tests...");

    // Save configurations
    const originalCluster = Config.get("SERVER_CLUSTER");
    const originalWindow = Config.get("SUSPICIOUS_WINDOW");
    const originalThreshold = Config.get("SUSPICIOUS_THRESHOLD");
    const originalDuration = Config.get("AUTO_BLOCK_DURATION");

    // Configure test parameters (window of 10s, threshold of 3 requests, block for 2s)
    Config.set("SERVER_CLUSTER", "false");
    Config.set("SUSPICIOUS_WINDOW", "10");
    Config.set("SUSPICIOUS_THRESHOLD", "3");
    Config.set("AUTO_BLOCK_DURATION", "2");

    // Clear memory cache and suspicious tracker to ensure clean state
    Vexora.Cache.clear();
    Vexora.resetSuspiciousTracker();

    // Start a temporary Vexora server
    const server = Vexora.Server((req, res) => {
        return res.success({ hello: "world" }, "Accessible");
    });

    await new Promise((resolve) => server.listen(3097, resolve));

    try {
        // Send 3 requests (within threshold) - should succeed (status 200)
        for (let i = 0; i < 3; i++) {
            const res = await Vexora.http.get("http://localhost:3097/", {
                headers: { "Connection": "close" }
            });
            assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
        }

        // Send 4th request - should trigger threshold exceed, set cache block, and return 403
        const resBlock = await Vexora.http.get("http://localhost:3097/", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(resBlock.status, 403, "4th request should exceed threshold and return 403 Forbidden");
        assert.strictEqual(resBlock.data.message, "Forbidden: Temporarily blocked due to suspicious activity");

        // Send 5th request immediately - should be blocked by cache check (403)
        const resStillBlocked = await Vexora.http.get("http://localhost:3097/", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(resStillBlocked.status, 403, "5th request should be blocked immediately by cache check");

        // Wait 2.1 seconds for temporary cache block to expire (duration is 2s)
        console.log("Waiting for temporary cache block to expire...");
        await new Promise((resolve) => setTimeout(resolve, 2100));

        // Send 6th request - should succeed now (200) since block expired
        const resRecovered = await Vexora.http.get("http://localhost:3097/", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(resRecovered.status, 200, "Request should succeed after block expiration");

        console.log("✅ Suspicious Behavior Blocking Tests Passed.\n");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        Config.set("SERVER_CLUSTER", originalCluster);
        Config.set("SUSPICIOUS_WINDOW", originalWindow);
        Config.set("SUSPICIOUS_THRESHOLD", originalThreshold);
        Config.set("AUTO_BLOCK_DURATION", originalDuration);
        Vexora.Cache.clear();
    }
}
