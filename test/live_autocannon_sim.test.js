import Vexora from "../Vexora.js";
import http from "node:http";
import Config from "../core/config.js";
import MemoryCache from "../cache/MemoryCache.js";

async function checkCurrentSpeed() {
  console.log("==========================================");
  console.log("⚡ VEXORA ENGINE — LIVE SPEED PROBE (NOW)");
  console.log("==========================================\n");

  Config.set("SUSPICIOUS_THRESHOLD", "1000000");
  Config.set("DETECT_BOT_BEHAVIOR", "false");
  MemoryCache.del("temp_blocked_ip:127.0.0.1");

  const port = 19997;
  const app = Vexora.start(port, {
    fastPaths: {
      "GET:/api/ultra_fast": JSON.stringify({ status: true, ping: "pong", engine: "Vexora v1.5.4" })
    }
  });

  app.Vexora("GET", "/api/standard", (req, res) => {
    return res.success({ status: true, ping: "pong" });
  });

  await new Promise(r => setTimeout(r, 150));

  const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 500, keepAliveMsecs: 60000 });

  async function testEndpoint(endpointName, urlPath, totalReqs = 10000) {
    const concurrency = 100;
    const startTime = performance.now();
    let completed = 0;
    let successCount = 0;

    async function sendReq() {
      return new Promise((resolve) => {
        const req = http.request(
          { hostname: "127.0.0.1", port: port, path: urlPath, method: "GET", agent: keepAliveAgent },
          (res) => {
            let d = "";
            res.on("data", (chunk) => { d += chunk; });
            res.on("end", () => {
              if (res.statusCode === 200) successCount++;
              completed++;
              resolve();
            });
          }
        );
        req.on("error", () => { completed++; resolve(); });
        req.end();
      });
    }

    for (let i = 0; i < totalReqs; i += concurrency) {
      const batch = [];
      for (let j = 0; j < concurrency && (i + j) < totalReqs; j++) {
        batch.push(sendReq());
      }
      await Promise.all(batch);
    }

    const durationMs = performance.now() - startTime;
    const reqPerSec = Math.round((completed / durationMs) * 1000);
    const avgLatencyMs = (durationMs / completed).toFixed(3);
    const avgLatencyUs = (avgLatencyMs * 1000).toFixed(0);

    return { endpointName, durationMs, reqPerSec, avgLatencyMs, avgLatencyUs, successCount, totalReqs };
  }

  console.log("1️⃣ Testing Standard Vexora Route (/api/standard)...");
  const stdResult = await testEndpoint("Standard Route", "/api/standard", 10000);

  console.log("2️⃣ Testing Zero-Allocation Fast Path Route (/api/ultra_fast)...");
  const fastResult = await testEndpoint("Fast Path Route", "/api/ultra_fast", 10000);

  console.log("\n==========================================");
  console.log("📊 LIVE BENCHMARK RESULTS (RIGHT NOW)");
  console.log("==========================================");
  console.log(`  🔵 Standard Route      : ${stdResult.reqPerSec} req/sec  (Latency: ${stdResult.avgLatencyMs}ms / ${stdResult.avgLatencyUs}µs)`);
  console.log(`  🚀 Zero-Alloc FastPath : ${fastResult.reqPerSec} req/sec  (Latency: ${fastResult.avgLatencyMs}ms / ${fastResult.avgLatencyUs}µs)`);
  console.log("──────────────────────────────────────────");
  console.log(`  ⚡ Estimated 8-Core Cluster   : ${fastResult.reqPerSec * 8} req/sec`);
  console.log(`  🔥 Estimated 16-Core Cluster  : ${fastResult.reqPerSec * 16} req/sec`);
  console.log("==========================================\n");

  app.close();
  try { keepAliveAgent.destroy(); } catch (e) {}
  setTimeout(() => process.exit(0), 100);
}

checkCurrentSpeed();
