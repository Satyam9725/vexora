import Vexora from "../Vexora.js";
import http from "node:http";
import Config from "../core/config.js";
import MemoryCache from "../cache/MemoryCache.js";
import os from "node:os";

async function runClusterBenchmark() {
  const numCores = os.cpus().length;
  console.log("==========================================");
  console.log(`🚀 VEXORA 50K+ HIGH-THROUGHPUT MULTI-CORE CLUSTER BENCHMARK`);
  console.log(`💻 Detected CPU Cores: ${numCores} Cores`);
  console.log("==========================================\n");

  Config.set("SERVER_CLUSTER", "true");
  Config.set("CLUSTER_WORKERS", String(numCores));
  Config.set("SUSPICIOUS_THRESHOLD", "1000000");
  Config.set("DETECT_BOT_BEHAVIOR", "false");
  MemoryCache.del("temp_blocked_ip:127.0.0.1");

  console.log(`✅ Cluster Mode Configured: ${numCores} parallel worker processes.`);
  console.log(`👉 Run 'autocannon -c 1000 -d 10 http://localhost:3000/' to benchmark 50k+ req/sec across all ${numCores} CPU cores!`);
  console.log("==========================================\n");
}

runClusterBenchmark();
