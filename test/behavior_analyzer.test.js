import assert from "assert";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running Behavior Analyzer Tests...");

    // Save configurations
    const originalCluster = Config.get("SERVER_CLUSTER");
    const originalDuration = Config.get("AUTO_BLOCK_DURATION");
    const originalBotDetection = Config.get("DETECT_BOT_BEHAVIOR");
    const originalMax404s = Config.get("MAX_CONSECUTIVE_404S");

    // Configure test parameters (block for 2s, bot detection enabled, 3 consecutive 404s threshold)
    Config.set("SERVER_CLUSTER", "false");
    Config.set("AUTO_BLOCK_DURATION", "2");
    Config.set("DETECT_BOT_BEHAVIOR", "true");
    Config.set("BOT_MIN_JITTER", "15");
    Config.set("MAX_CONSECUTIVE_404S", "3");

    // Clear caches
    Vexora.Cache.clear();
    Vexora.resetSuspiciousTracker();

    // Start server
    const server = Vexora.Server((req, res) => {
        if (req.path === "/not-found") {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
            return;
        }
        return res.success({ hello: "world" }, "Success");
    });

    await new Promise((resolve) => server.listen(3096, resolve));

    try {
        // --- 1. Test Headless / Bot User-Agent Blocking ---
        const userAgentRes = await Vexora.http.get("http://localhost:3096/", {
            headers: { 
                "Connection": "close",
                "User-Agent": "puppeteer" 
            }
        });
        assert.strictEqual(userAgentRes.status, 403, "Requests with 'puppeteer' User-Agent should be blocked");
        assert.strictEqual(userAgentRes.data.message, "Forbidden: Temporarily blocked due to suspicious activity");

        // Clear temporary block
        Vexora.Cache.clear();
        Vexora.resetSuspiciousTracker();

        // --- 2. Test Route Fuzzing / Brute-force 404 Auto-blocking ---
        // Send 2 requests to non-existent endpoint (allowed under max 404 limit of 3)
        for (let i = 0; i < 2; i++) {
            const res404 = await Vexora.http.get("http://localhost:3096/not-found", {
                headers: { "Connection": "close" }
            });
            assert.strictEqual(res404.status, 404, `404 request ${i + 1} should return 404`);
        }

        // 3rd 404 request triggers the block limit (consecutive 404s >= 3)
        const resBlock404 = await Vexora.http.get("http://localhost:3096/not-found", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(resBlock404.status, 404, "3rd 404 request resolves to 404, but registers the block on finish");

        // Give a few milliseconds for finish event to complete and register block
        await new Promise((resolve) => setTimeout(resolve, 50));

        // 4th request (even to a valid endpoint) should now be blocked with 403
        const resBlocked404 = await Vexora.http.get("http://localhost:3096/", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(resBlocked404.status, 403, "Subsequent request should be blocked due to route fuzzing");

        // Clear temporary block
        Vexora.Cache.clear();
        Vexora.resetSuspiciousTracker();

        // --- 3. Test Bot Regularity (Interval Jitter) Blocking ---
        // Send 6 requests with exactly 50ms intervals (jitter = 0ms < 15ms limit)
        // 6 requests will register 5 intervals. The 7th request will exceed the std dev limit and be blocked.
        for (let i = 0; i < 6; i++) {
            const resReg = await Vexora.http.get("http://localhost:3096/", {
                headers: { "Connection": "close" }
            });
            assert.strictEqual(resReg.status, 200, `Regular request ${i + 1} should succeed`);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // The 7th request has standard deviation near 0, should trigger bot detection block (403)
        const resBlockedBot = await Vexora.http.get("http://localhost:3096/", {
            headers: { "Connection": "close" }
        });
        assert.strictEqual(resBlockedBot.status, 403, "Request with low jitter / constant intervals should be blocked as a bot");

        console.log("✅ Behavior Analyzer Tests Passed.\n");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        Config.set("SERVER_CLUSTER", originalCluster);
        Config.set("AUTO_BLOCK_DURATION", originalDuration);
        Config.set("DETECT_BOT_BEHAVIOR", originalBotDetection);
        Config.set("MAX_CONSECUTIVE_404S", originalMax404s);
        Vexora.Cache.clear();
        Vexora.resetSuspiciousTracker();
    }
}
