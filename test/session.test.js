import assert from "assert";
import SessionManager from "../session/SessionManager.js";
import MemoryCache from "../cache/MemoryCache.js";

export async function run() {
    console.log("👉 Running Session Tests...");

    // Test session start
    const sessionId = SessionManager.start();
    assert.ok(sessionId, "Should generate a session ID");
    
    // Test check validity
    assert.ok(SessionManager._isValid(sessionId), "Session ID should be valid");

    // Test setting and getting session data
    const mockSession = {
        _lifetime: 3600,
        _createdAt: Date.now(),
        user_id: 123
    };
    SessionManager.set(sessionId, mockSession);
    
    const retrieved = SessionManager.get(sessionId);
    assert.strictEqual(retrieved.user_id, 123, "Should retrieve user_id from session");

    // Test user keys check
    assert.ok(SessionManager.hasUserKeys(mockSession), "Should confirm mockSession contains user keys");
    assert.ok(!SessionManager.hasUserKeys({ _lifetime: 3600 }), "Should return false if only system fields exist");

    // Test session destroy
    SessionManager.destroy(sessionId);
    assert.ok(!SessionManager._isValid(sessionId), "Session should be invalid after destroy");

    console.log("✅ Session Tests Passed.\n");
}
