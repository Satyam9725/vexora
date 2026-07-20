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
        removeListener() { return this; }
    };
    resMock.res = resMock; 

    const served = await serveHandler(reqNormal, resMock);
    assert.ok(served, "Should resolve true for existing file");
    assert.strictEqual(headers["Content-Type"], "text/plain; charset=utf-8", "Should serve correct MIME type");

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
