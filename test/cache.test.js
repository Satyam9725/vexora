import assert from "assert";
import MemoryCache from "../cache/MemoryCache.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running Cache Tests...");
    
    // Test basic set/get
    MemoryCache.set("test_key", "test_value");
    assert.strictEqual(MemoryCache.get("test_key"), "test_value", "Should get cached value");
    assert.ok(MemoryCache.has("test_key"), "Should confirm key exists");

// run

    // Test TTL expiration by manually modifying the stored item expiresAt
    MemoryCache.set("ttl_key", "expired", 10);
    const item = MemoryCache.store.get("ttl_key");
    if (item) {
        item.expiresAt = Date.now() - 1000;
    }
    assert.strictEqual(MemoryCache.get("ttl_key"), null, "Should return null for expired keys");

    // Test atomic counter increment/decrement
    MemoryCache.set("counter", 10);
    const inc = MemoryCache.incr("counter");
    assert.strictEqual(inc, 11, "Counter should increment to 11");
    assert.strictEqual(MemoryCache.get("counter"), 11);

    const dec = MemoryCache.decr("counter", 2);
    assert.strictEqual(dec, 9, "Counter should decrement by 2 to 9");
    assert.strictEqual(MemoryCache.get("counter"), 9);

    // Test info_redis and limits
    MemoryCache.clear();
    const info = MemoryCache.info_redis();
    assert.strictEqual(info.status, "connected");
    assert.strictEqual(info.total_keys, 0);
    assert.strictEqual(typeof info.used_memory_bytes, "number");
    
    // Set a low limit to verify enforcement
    Config.set("REDIS_DATABASE_SIZE", "1KB"); // 1024 bytes
    
    // First insert is ~600 bytes (300 chars * 2 bytes/char)
    const largeStr = "a".repeat(300);
    const setFirst = MemoryCache.set("large_key_1", largeStr);
    assert.ok(setFirst, "First large insert should succeed under 1KB limit");
    
    // Second insert of same size exceeds the 1KB limit and should be rejected
    const setSecond = MemoryCache.set("large_key_2", largeStr);
    assert.strictEqual(setSecond, false, "Second large insert should fail because it exceeds 1KB limit");
    
    // Restore size limit to default 500MB
    Config.set("REDIS_DATABASE_SIZE", "500MB");
    const setSecondAgain = MemoryCache.set("large_key_2", largeStr);
    assert.ok(setSecondAgain, "Insert should succeed after increasing size limit back to 500MB");

    console.log("✅ Cache Tests Passed.\n");
}
