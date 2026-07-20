import assert from "assert";
import Vexora from "../Vexora.js";

export async function run() {
    console.log("👉 Running CSRF Middleware Tests...");

    // ok 
    
    // Mock Response wrapper
    class MockResponse {
        constructor() {
            this.statusCode = 200;
            this.headers = {};
            this.cookiesList = {};
            this.errorData = null;
        }
        
        status(code) {
            this.statusCode = code;
            return this;
        }

        header(name, value) {
            this.headers[name] = value;
            return this;
        }

        setHeader(name, value) {
            this.headers[name] = value;
            return this;
        }

        cookie(name, value, options = {}) {
            this.cookiesList[name] = { value, options };
            return this;
        }

        error(msg, code) {
            this.statusCode = code;
            this.errorData = { status: false, message: msg };
            return this;
        }
    }

    // 1. GET requests should distribute tokens
    const getReq = {
        method: "GET",
        session: {},
        headers: {}
    };
    const getRes = new MockResponse();
    
    const getBlocked = Vexora.csrf(getReq, getRes);
    assert.strictEqual(getBlocked, false, "GET requests should not be blocked by CSRF middleware");
    assert.ok(getReq.session._csrf, "GET request should initialize CSRF token in session");
    assert.strictEqual(getRes.headers["x-csrf-token"], getReq.session._csrf, "GET request response headers should contain the CSRF token");
    assert.ok(getRes.cookiesList["XSRF-TOKEN"], "GET request response cookies should set XSRF-TOKEN");
    assert.strictEqual(getRes.cookiesList["XSRF-TOKEN"].value, getReq.session._csrf, "GET request response XSRF-TOKEN cookie should match the generated token");

    // 2. POST request with NO token should be blocked (403)
    const postReqNoToken = {
        method: "POST",
        session: { _csrf: "my-valid-token" },
        headers: {},
        input(key) {
            return null;
        }
    };
    const postResNoToken = new MockResponse();
    const postBlockedNoToken = Vexora.csrf(postReqNoToken, postResNoToken);
    
    assert.strictEqual(postBlockedNoToken, true, "POST request with no token should be blocked");
    assert.strictEqual(postResNoToken.statusCode, 403, "Response status code should be 403 Forbidden");
    assert.strictEqual(postResNoToken.errorData.message, "CSRF Token Invalid or Missing", "Blocked response should specify CSRF error message");

    // 3. POST request with VALID token in body should pass
    const postReqValidBody = {
        method: "POST",
        session: { _csrf: "my-valid-token" },
        headers: {},
        input(key) {
            if (key === "_token") return "my-valid-token";
            return null;
        }
    };
    const postResValidBody = new MockResponse();
    const postBlockedValidBody = Vexora.csrf(postReqValidBody, postResValidBody);
    
    assert.strictEqual(postBlockedValidBody, false, "POST request with valid body token should not be blocked");

    // 4. POST request with VALID token in headers should pass
    const postReqValidHeader = {
        method: "POST",
        session: { _csrf: "my-valid-token" },
        headers: {
            "x-csrf-token": "my-valid-token"
        },
        input(key) {
            return null;
        }
    };
    const postResValidHeader = new MockResponse();
    const postBlockedValidHeader = Vexora.csrf(postReqValidHeader, postResValidHeader);
    
    assert.strictEqual(postBlockedValidHeader, false, "POST request with valid header token should not be blocked");

    // 5. Test Token Rotation (Vexora.csrf.rotate)
    const rotateReq = {
        session: { _csrf: "old-csrf-token" }
    };
    const newToken = Vexora.csrf.rotate(rotateReq);
    assert.ok(newToken, "Should generate a rotated token");
    assert.notStrictEqual(newToken, "old-csrf-token", "Rotated token should be different");
    assert.strictEqual(rotateReq.session._csrf, newToken, "Rotated token should be stored in session");

    // 6. Test Excluded Paths configuration
    Vexora.csrf.configure({
        excludePaths: ["/webhooks", /^\/api\/v2\/.*/]
    });

    const webhookReq = {
        method: "POST",
        path: "/webhooks/stripe",
        session: { _csrf: "csrf-val" },
        headers: {},
        input(key) { return null; }
    };
    const webhookRes = new MockResponse();
    const webhookBlocked = Vexora.csrf(webhookReq, webhookRes);
    assert.strictEqual(webhookBlocked, false, "Excluded prefix paths should bypass CSRF check");

    const regexReq = {
        method: "POST",
        path: "/api/v2/users/123",
        session: { _csrf: "csrf-val" },
        headers: {},
        input(key) { return null; }
    };
    const regexRes = new MockResponse();
    const regexBlocked = Vexora.csrf(regexReq, regexRes);
    assert.strictEqual(regexBlocked, false, "Excluded regex paths should bypass CSRF check");

    // 7. Test Custom Cookie & Header Name configuration
    Vexora.csrf.configure({
        cookieName: "CUSTOM-XSRF",
        headerName: "x-custom-csrf",
        paramName: "csrf_input"
    });

    // Custom configuration GET request
    const customGetReq = {
        method: "GET",
        session: {},
        headers: {}
    };
    const customGetRes = new MockResponse();
    Vexora.csrf(customGetReq, customGetRes);

    assert.ok(customGetRes.cookiesList["CUSTOM-XSRF"], "Should set custom configured cookie name");
    assert.strictEqual(customGetRes.headers["x-custom-csrf"], customGetReq.session._csrf, "Should set custom configured header name");

    // Custom configuration POST request verification
    const customPostReq = {
        method: "POST",
        session: { _csrf: "custom-token-val" },
        headers: {
            "x-custom-csrf": "custom-token-val"
        },
        input(key) {
            if (key === "csrf_input") return "custom-token-val";
            return null;
        }
    };
    const customPostRes = new MockResponse();
    const customPostBlocked = Vexora.csrf(customPostReq, customPostRes);
    assert.strictEqual(customPostBlocked, false, "POST request with custom header configuration should pass");

    // 8. Test Vexora.csrf.generate & Vexora.csrf.verify
    const generatedCsrf = Vexora.csrf.generate({ bindDevice: true, maxUses: 1, ttl: "1H" });
    assert.ok(generatedCsrf, "Vexora.csrf.generate() should generate a sealed CSRF token");

    const isValidSelf = Vexora.csrf.verify(generatedCsrf);
    assert.strictEqual(isValidSelf, true, "Vexora.csrf.verify(generatedCsrf) should return true");

    const isMatchTiming = Vexora.csrf.verify("my_secret_token", "my_secret_token");
    assert.strictEqual(isMatchTiming, true, "Vexora.csrf.verify(tokenA, tokenB) timing safe comparison should match");

    const isMismatchTiming = Vexora.csrf.verify("token_A", "token_B");
    assert.strictEqual(isMismatchTiming, false, "Vexora.csrf.verify(tokenA, tokenB) timing safe comparison should fail on mismatch");

    console.log("✅ CSRF Middleware Tests Passed.\n");
}
