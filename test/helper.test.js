import assert from "assert";
import Helper from "../utils/Helper.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running Helper Tests...");

    // Test password hashing and verification
    const pass = "secret_123";
    const hashed = Helper.hashPassword(pass);
    assert.ok(hashed.startsWith("$2y$10$"), "Hash format should match PHP $2y$ Bcrypt standard");
    
    const isValid = Helper.verifyPassword(pass, hashed);
    assert.ok(isValid, "Password verification should pass");

    const isInvalid = Helper.verifyPassword("wrong_pass", hashed);
    assert.ok(!isInvalid, "Password verification should fail for invalid passwords");

    // Test AES Encryption / Decryption
    Config.set("AES_SECRET", "super-strong-aes-secret-key-12345");
    const plainText = "Vexora Security Hardening";
    const encrypted = Helper.encrypt(plainText);
    
    assert.ok(encrypted.includes(":"), "Ciphertext format should include IV/tag separators");
    
    const decrypted = Helper.decrypt(encrypted);
    assert.strictEqual(decrypted, plainText, "Decrypted text should match original plain text");

    // Test secure IP address lookup
    const req = {
        headers: {
            "cf-connecting-ip": "8.8.8.8",
            "x-forwarded-for": "1.1.1.1, 2.2.2.2"
        },
        socket: {
            remoteAddress: "127.0.0.1"
        }
    };
    
    Config.set("TRUST_PROXY", "false");
    assert.strictEqual(Helper.getClientIp(req), "127.0.0.1", "Should use remoteAddress if trust proxy is disabled");

    delete req._ip;
    Config.set("TRUST_PROXY", "true");
    assert.strictEqual(Helper.getClientIp(req), "8.8.8.8", "Should use cf-connecting-ip if trust proxy is enabled");

    // Test CSRF Token generation and verification
    const mockCsrfReq = {
        session: {},
        input(key) {
            return this.body && this.body[key];
        },
        headers: {}
    };
    const csrfToken = Helper.generateCsrfToken(mockCsrfReq);
    assert.ok(csrfToken, "Should generate a CSRF token");
    assert.strictEqual(mockCsrfReq.session._csrf, csrfToken, "Should save token in session");

    // Verify correct token via body
    mockCsrfReq.body = { _token: csrfToken };
    assert.ok(Helper.verifyCsrfToken(mockCsrfReq), "Should verify correct CSRF token from body");

    // Verify correct token via header
    mockCsrfReq.body = {};
    mockCsrfReq.headers["x-csrf-token"] = csrfToken;
    assert.ok(Helper.verifyCsrfToken(mockCsrfReq), "Should verify correct CSRF token from header");

    // Verify invalid token fails
    mockCsrfReq.headers["x-csrf-token"] = "wrong-csrf-token";
    assert.ok(!Helper.verifyCsrfToken(mockCsrfReq), "Should fail validation for incorrect CSRF token");

    console.log("✅ Helper Tests Passed.\n");
}
