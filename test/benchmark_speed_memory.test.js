import Vexora from "../Vexora.js";
import http from "node:http";
import MemoryCache from "../cache/MemoryCache.js";
import BehaviorAnalyzer from "../security/BehaviorAnalyzer.js";
import Config from "../core/config.js";

function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    rssMB: (mem.rss / 1024 / 1024).toFixed(2),
    heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
    externalMB: (mem.external / 1024 / 1024).toFixed(2)
  };
}

async function runBenchmark() {
  // Clear any existing temp block and disable bot/suspicious limits for pure raw benchmark
  MemoryCache.del("temp_blocked_ip:127.0.0.1");
  MemoryCache.del("temp_blocked_ip:::1");
  Config.set("SUSPICIOUS_THRESHOLD", "100000");
  Config.set("DETECT_BOT_BEHAVIOR", "false");
  if (BehaviorAnalyzer) BehaviorAnalyzer.isEnabled = false;

  console.log("==========================================");
  console.log("⚡ VEXORA ENGINE — RAW SPEED & MEMORY BENCHMARK");
  console.log("==========================================\n");

  const startMem = getMemoryStats();
  console.log("1️⃣ Initial Baseline Memory Usage:");
  console.log(`   • RSS Memory  : ${startMem.rssMB} MB`);
  console.log(`   • Heap Used   : ${startMem.heapUsedMB} MB`);
  console.log(`   • Heap Total  : ${startMem.heapTotalMB} MB\n`);

  // Start Vexora Server
  const port = 19999;
  const app = Vexora.start(port);

  // Add ultra-fast benchmark route
  app.Vexora("GET", "/api/fast_ping", (req, res) => {
    return res.success({ ping: "pong", timestamp: Date.now() });
  });

  await new Promise(r => setTimeout(r, 200));

  const totalRequests = 5000;
  const concurrency = 50;
  console.log(`2️⃣ Launching Load Test: ${totalRequests} Requests (${concurrency} Concurrent connections)...`);

  const startTime = performance.now();
  let completed = 0;
  let successCount = 0;

  async function sendRequest() {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: port,
          path: "/api/fast_ping",
          method: "GET"
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => { data += chunk; });
          res.on("end", () => {
            if (res.statusCode === 200) successCount++;
            completed++;
            resolve();
          });
        }
      );
      req.on("error", () => {
        completed++;
        resolve();
      });
      req.end();
    });
  }

  // Execute in concurrent batches
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batch = [];
    for (let j = 0; j < concurrency && (i + j) < totalRequests; j++) {
      batch.push(sendRequest());
    }
    await Promise.all(batch);
  }

  const durationMs = performance.now() - startTime;
  const reqPerSec = Math.round((completed / durationMs) * 1000);
  const avgLatencyMs = (durationMs / completed).toFixed(3);

  const peakMem = getMemoryStats();

  console.log("\n==========================================");
  console.log("📊 VEXORA SPEED & MEMORY BENCHMARK RESULTS");
  console.log("==========================================");
  console.log(`  ⏱️ Total Duration    : ${durationMs.toFixed(2)} ms`);
  console.log(`  🚀 Requests/Sec      : ${reqPerSec} req/s`);
  console.log(`  ⚡ Avg Latency       : ${avgLatencyMs} ms (${(avgLatencyMs * 1000).toFixed(0)} µs)`);
  console.log(`  ✅ Success Rate      : ${((successCount / totalRequests) * 100).toFixed(2)}% (${successCount}/${totalRequests})`);
  console.log("──────────────────────────────────────────");
  console.log(`  💾 RSS Memory        : ${peakMem.rssMB} MB  (Baseline: ${startMem.rssMB} MB)`);
  console.log(`  🧠 Heap Memory Used  : ${peakMem.heapUsedMB} MB  (Baseline: ${startMem.heapUsedMB} MB)`);
  console.log("==========================================\n");

  app.close();
  setTimeout(() => process.exit(0), 100);
}

runBenchmark();
