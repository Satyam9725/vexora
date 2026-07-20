import assert from "assert";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running CAPTCHA Verification Tests...");

    // Configure test secret and provider
    const originalSecret = Config.get("RECAPTCHA_SECRET");
    const originalProvider = Config.get("CAPTCHA_PROVIDER");
    Config.set("RECAPTCHA_SECRET", "my-secret-key");
    Config.set("CAPTCHA_PROVIDER", "google");

    // Temporarily mock fetch for siteverify endpoints
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        if (url.includes("google.com") || url.includes("cloudflare.com")) {
            const body = options.body;
            const params = new URLSearchParams(body);
            const secret = params.get("secret");
            const responseToken = params.get("response");
            
            if (responseToken === "valid-token" && secret === "my-secret-key") {
                return {
                    ok: true,
                    headers: new Headers({ "content-type": "application/json" }),
                    json: async () => ({ success: true, score: 0.9, hostname: "localhost" })
                };
            }
            return {
                ok: true,
                headers: new Headers({ "content-type": "application/json" }),
                json: async () => ({ success: false, "error-codes": ["invalid-input-response"] })
            };
        }
        return originalFetch(url, options);
    };

    try {
        // --- 1. Test Direct verifyCaptcha() Function ---
        // A. Valid token
        const successResult = await Vexora.verifyCaptcha("valid-token");
        assert.ok(successResult.success, "Valid CAPTCHA token should succeed");
        assert.strictEqual(successResult.score, 0.9);

        // B. Invalid token
        const failResult = await Vexora.verifyCaptcha("invalid-token");
        assert.ok(!failResult.success, "Invalid CAPTCHA token should fail");
        assert.ok(failResult.errorCodes.includes("invalid-input-response"));

        // --- 2. Test captcha() Middleware ---
        const originalCluster = Config.get("SERVER_CLUSTER");
        Config.set("SERVER_CLUSTER", "false");

        // Start Vexora Server with CAPTCHA middleware
        const captchaMiddleware = Vexora.captcha({ tokenField: "captcha_token" });
        const server = Vexora.Server(async (req, res) => {
            const blocked = await captchaMiddleware(req, res);
            if (blocked) return;

            return res.success(null, "CAPTCHA verified successfully!");
        });

        await new Promise((resolve) => server.listen(3095, resolve));

        try {
            // A. Request without CAPTCHA token (should get 422)
            const resNoToken = await Vexora.http.post("http://localhost:3095/", {}, {
                headers: { "Connection": "close" }
            });
            assert.strictEqual(resNoToken.status, 422, "Request without token should return 422");
            assert.strictEqual(resNoToken.data.message, "CAPTCHA token is required");

            // B. Request with invalid CAPTCHA token (should get 403)
            const resInvalidToken = await Vexora.http.post("http://localhost:3095/", {
                captcha_token: "invalid-token"
            }, {
                headers: { "Connection": "close" }
            });
            assert.strictEqual(resInvalidToken.status, 403, "Request with invalid token should return 403");

            // C. Request with valid CAPTCHA token (should get 200)
            const resValidToken = await Vexora.http.post("http://localhost:3095/", {
                captcha_token: "valid-token"
            }, {
                headers: { "Connection": "close" }
            });
            assert.strictEqual(resValidToken.status, 200, "Request with valid token should succeed");
            assert.strictEqual(resValidToken.data.message, "CAPTCHA verified successfully!");

        } finally {
            await new Promise((resolve) => server.close(resolve));
            Config.set("SERVER_CLUSTER", originalCluster);
        }

        console.log("✅ CAPTCHA Verification Tests Passed.\n");
    } finally {
        globalThis.fetch = originalFetch;
        Config.set("RECAPTCHA_SECRET", originalSecret);
        Config.set("CAPTCHA_PROVIDER", originalProvider);
    }
}
