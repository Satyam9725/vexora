import assert from "assert";
import fs from "fs";
import path from "path";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running HTTP Client Tests...");

    // Temporarily disable clustering and bot behavior detection for testing
    const originalCluster = Config.get("SERVER_CLUSTER");
    Config.set("SERVER_CLUSTER", "false");
    const originalBot = Config.get("DETECT_BOT_BEHAVIOR");
    Config.set("DETECT_BOT_BEHAVIOR", "false");
    Vexora.resetSuspiciousTracker();

    // Start a temporary Vexora server to send requests to
    const server = Vexora.Server((req, res) => {
        if (req.method === "GET" && req.path === "/test-get") {
            return res.success({ query: req.query }, "GET response");
        }
        if (req.method === "POST" && req.path === "/test-post") {
            return res.success({ body: req.body }, "POST response");
        }
        if (req.method === "DELETE" && req.path === "/test-delete") {
            return res.success(null, "DELETE response");
        }
    });

    await new Promise((resolve) => server.listen(3099, resolve));

    try {
        // Test GET request
        const getRes = await Vexora.http.get("http://localhost:3099/test-get", {
            headers: { "Connection": "close" },
            query: { name: "satyam" }
        });
        assert.ok(getRes.ok);
        assert.strictEqual(getRes.status, 200);
        assert.strictEqual(getRes.data.data.query.name, "satyam");

        // Test that requesting an invalid /api path returns JSON 404 instead of HTML landing page
        const apiHtmlRes = await Vexora.http.get("http://localhost:3099/api/", {
            headers: { 
                "Connection": "close",
                "Accept": "text/html"
            }
        });
        assert.strictEqual(apiHtmlRes.status, 404);
        assert.ok(apiHtmlRes.headers["content-type"].includes("application/json"), "Should return JSON content-type");
        assert.strictEqual(apiHtmlRes.data.status, false);
        assert.strictEqual(apiHtmlRes.data.message, "API Route Not Found");

        // Test that requesting a non-existent file path with Accept: text/html returns the HTML 404 page
        const fileHtmlRes = await Vexora.http.get("http://localhost:3099/index1.html1", {
            headers: { 
                "Connection": "close",
                "Accept": "text/html"
            }
        });
        assert.strictEqual(fileHtmlRes.status, 404);
        assert.ok(fileHtmlRes.headers["content-type"].includes("text/html"), "Should return HTML content-type");
        assert.ok(fileHtmlRes.data.includes("File Not Found"), "Should contain File Not Found header");
        assert.ok(fileHtmlRes.data.includes("/index1.html1"), "Should display requested file path");

        // Create custom .Vexora_error directory and 404.html page
        const errorDir = path.join(process.cwd(), ".Vexora_error");
        if (!fs.existsSync(errorDir)) {
            fs.mkdirSync(errorDir);
        }
        const custom404Path = path.join(errorDir, "404.html");
        fs.writeFileSync(custom404Path, "<h1>My Custom 404 Page</h1>");

        try {
            // Test that requesting a non-existent file path with Accept: text/html returns the custom 404.html page
            const custom404Res = await Vexora.http.get("http://localhost:3099/index1.html1", {
                headers: { 
                    "Connection": "close",
                    "Accept": "text/html"
                }
            });
            assert.strictEqual(custom404Res.status, 404);
            assert.ok(custom404Res.headers["content-type"].includes("text/html"), "Should return HTML content-type");
            assert.ok(custom404Res.data.includes("<h1>My Custom 404 Page</h1>"), "Should serve custom 404 page content");
        } finally {
            try {
                fs.unlinkSync(custom404Path);
                fs.rmdirSync(errorDir);
            } catch (e) {}
        }

        // Create custom lowercase .vexora_error directory and 404.html page
        const errorDirLower = path.join(process.cwd(), ".vexora_error");
        if (!fs.existsSync(errorDirLower)) {
            fs.mkdirSync(errorDirLower);
        }
        const custom404PathLower = path.join(errorDirLower, "404.html");
        fs.writeFileSync(custom404PathLower, "<h1>My Custom Lowercase 404 Page</h1>");

        try {
            // Test that requesting a non-existent file path with Accept: text/html returns the custom 404.html page from lowercase folder
            const custom404ResLower = await Vexora.http.get("http://localhost:3099/index1.html1", {
                headers: { 
                    "Connection": "close",
                    "Accept": "text/html"
                }
            });
            assert.strictEqual(custom404ResLower.status, 404);
            assert.ok(custom404ResLower.headers["content-type"].includes("text/html"), "Should return HTML content-type");
            assert.ok(custom404ResLower.data.includes("<h1>My Custom Lowercase 404 Page</h1>"), "Should serve custom lowercase 404 page content");
        } finally {
            // Clean up custom error directory
            try {
                fs.unlinkSync(custom404PathLower);
                fs.rmdirSync(errorDirLower);
            } catch (e) {}
        }

        // Test POST request
        const postRes = await Vexora.http.post("http://localhost:3099/test-post", {
            role: "admin"
        }, {
            headers: { "Connection": "close" }
        });
        assert.ok(postRes.ok);
        assert.strictEqual(postRes.status, 200);
        assert.strictEqual(postRes.data.data.body.role, "admin");

        // Test DELETE request
        const deleteRes = await Vexora.http.delete("http://localhost:3099/test-delete", {
            headers: { "Connection": "close" }
        });
        assert.ok(deleteRes.ok);
        assert.strictEqual(deleteRes.status, 200);
        assert.strictEqual(deleteRes.data.message, "DELETE response");

        console.log("✅ HTTP Client Tests Passed.\n");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        Config.set("SERVER_CLUSTER", originalCluster);
        Config.set("DETECT_BOT_BEHAVIOR", originalBot);
        Vexora.resetSuspiciousTracker();
    }
}
