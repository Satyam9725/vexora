import assert from "assert";
import fs from "fs";
import path from "path";
import StaticMiddleware from "../api_controller/StaticMiddleware.js";

export async function run() {
    console.log("👉 Running Static Middleware Tests...");

    // Create a temporary public directory and test file
    const publicDir = path.join(process.cwd(), "test_public");
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }
    const testFilePath = path.join(publicDir, "test.txt");
    fs.writeFileSync(testFilePath, "Hello Vexora Static");

    const serveHandler = StaticMiddleware.serve("test_public");

    // Test normal match
    const reqNormal = { method: "GET", path: "/test.txt" };
    let headers = {};
    let statusCode = 200;
    const resMock = {
        statusCode: 200,
        setHeader(name, value) {
            headers[name] = value;
        },
        write(chunk) {
            this.body = (this.body || "") + chunk.toString();
            return true;
        },
        end(data) {
            if (data) this.write(data);
        },
        on() { return this; },
        once() { return this; },
        emit() { return this; },
        removeListener() { return this; },
        destroy() { return this; }
    };
    resMock.res = resMock; 

    const served = await serveHandler(reqNormal, resMock);
    assert.ok(served, "Should resolve true for existing file");
    assert.strictEqual(headers["Content-Type"], "text/plain; charset=utf-8", "Should serve correct MIME type");
    
    // Verify default Cache-Control, ETag, and Last-Modified headers are generated
    assert.strictEqual(headers["Cache-Control"], "no-store, no-cache, must-revalidate", "Default maxAge=0 should set no-store/no-cache/must-revalidate");
    assert.ok(headers["ETag"], "Should generate ETag header");
    assert.ok(headers["Last-Modified"], "Should generate Last-Modified header");

    const savedETag = headers["ETag"];
    const savedLastModified = headers["Last-Modified"];

    // Test If-None-Match header matching -> 304 response
    let headers304 = {};
    const reqIfNoneMatch = { 
        method: "GET", 
        path: "/test.txt",
        headers: { "if-none-match": savedETag }
    };
    const resMock304 = {
        statusCode: 200,
        setHeader(name, value) {
            headers304[name] = value;
        },
        end() {},
        on() { return this; },
        once() { return this; },
        emit() { return this; },
        removeListener() { return this; },
        destroy() { return this; }
    };
    resMock304.res = resMock304;

    const served304 = await serveHandler(reqIfNoneMatch, resMock304);
    assert.ok(served304, "Should handle conditional request");
    assert.strictEqual(resMock304.statusCode, 304, "Should return 304 status code");

    // Test If-Modified-Since header matching -> 304 response
    let headersModified304 = {};
    const reqIfModifiedSince = {
        method: "GET",
        path: "/test.txt",
        headers: { "if-modified-since": savedLastModified }
    };
    const resMockModified304 = {
        statusCode: 200,
        setHeader(name, value) {
            headersModified304[name] = value;
        },
        end() {},
        on() { return this; },
        once() { return this; },
        emit() { return this; },
        removeListener() { return this; },
        destroy() { return this; }
    };
    resMockModified304.res = resMockModified304;

    const servedMod304 = await serveHandler(reqIfModifiedSince, resMockModified304);
    assert.ok(servedMod304, "Should handle conditional request");
    assert.strictEqual(resMockModified304.statusCode, 304, "Should return 304 status code");

    // Test configured maxAge sets Cache-Control correctly
    const serveHandlerCached = StaticMiddleware.serve("test_public", { maxAge: 3600 });
    let cachedHeaders = {};
    const resMockCached = {
        statusCode: 200,
        setHeader(name, value) {
            cachedHeaders[name] = value;
        },
        write(chunk) { return true; },
        end() {},
        on() { return this; },
        once() { return this; },
        emit() { return this; },
        removeListener() { return this; },
        destroy() { return this; }
    };
    resMockCached.res = resMockCached;

    await serveHandlerCached(reqNormal, resMockCached);
    assert.strictEqual(cachedHeaders["Cache-Control"], "public, max-age=3600", "Configured maxAge should set Cache-Control header correctly");

    // Test directory traversal rejection
    const reqTraversal = { method: "GET", path: "/../package.json" };
    const servedTraverse = await serveHandler(reqTraversal, resMock);
    assert.ok(!servedTraverse, "Should return false (skip execution) for dynamic directory traversal paths");

    // Cleanup
    try {
        fs.unlinkSync(testFilePath);
        fs.rmdirSync(publicDir);
    } catch {}

    console.log("✅ Static Middleware Tests Passed.\n");
}
