import assert from "assert";
import Vexora from "../Vexora.js";
import Router from "../http/Router.js";

export async function run() {
    console.log("👉 Running Router Tests...");
    const r = Router();
    
    // Test base path matching
    r.get("/profile", (req, res) => "profile_called");
    
    // Simulate req/res
    const req = { method: "GET", url: "/profile", headers: {} };
    let called = false;
    const res = {
        statusCode: 200,
        json(data) {
            called = true;
            return this;
        }
    };
    
    const matched = r._findRoute("GET", "/profile");
    assert.ok(matched, "Should find registered route /profile");
    assert.strictEqual(typeof matched.action, "function");

    // Test parameter matching
    r.get("/users/:id", (req, res) => "user_view");
    const matchedParam = r._findRoute("GET", "/users/42");
    assert.ok(matchedParam, "Should find parameterized route");
    assert.strictEqual(matchedParam.params.id, "42", "Should extract URL parameter 'id'");

    // Test method not allowed
    const resMethod = {
        statusCode: 200,
        json(data) {
            this.body = data;
            return this;
        }
    };
    await r.handle({ method: "POST", url: "/profile" }, resMethod);
    assert.strictEqual(resMethod.statusCode, 405, "Should return 405 Method Not Allowed");

    console.log("✅ Router Tests Passed.\n");
}
