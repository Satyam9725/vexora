/**
 * Vexora Framework - RAM Cache & Redis Commands
 */

import { line } from "./helpers.js";

export const cacheCommands = {
  "redis:list": {
    description: "Lists all keys currently in RAM Cache / Redis",
    category: "⚡ Cache / Redis",
    aliases: ["cache:list"],
    async run() {
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      line();
      console.log("⚡ VEXORA RAM CACHE / REDIS KEYS");
      line();
      const keys = MemoryCache.keys();
      if (!keys || keys.length === 0) {
        console.log("  (No active keys currently cached in RAM)");
      } else {
        keys.forEach((key, idx) => {
          const val = MemoryCache.get(key);
          console.log(`  ${idx + 1}. [KEY] ${key}  →  ${JSON.stringify(val)}`);
        });
      }
      line();
    },
  },

  "redis:info": {
    description: "Displays RAM Cache / Redis memory & usage info",
    category: "⚡ Cache / Redis",
    aliases: ["cache:info"],
    async run() {
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      line();
      console.log("⚡ VEXORA RAM CACHE / REDIS INFO");
      line();
      const info = MemoryCache.info_redis();
      console.log(`  • Status         : 🟢 ${info.status}`);
      console.log(`  • Total Keys     : ${info.total_keys}`);
      console.log(`  • Persistent     : ${info.persistent_keys}`);
      console.log(`  • TTL Keys       : ${info.ttl_keys}`);
      console.log(`  • Memory Used    : ${info.used_memory_human}`);
      console.log(`  • Max Memory     : ${info.max_memory_human}`);
      console.log(`  • Usage          : ${info.memory_usage_percentage}`);
      line();
    },
  },

  "cache:clear": {
    description: "Clears all data from RAM Cache / Redis",
    category: "⚡ Cache / Redis",
    aliases: ["redis:flush"],
    async run() {
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      MemoryCache.flush();
      console.log("✅ RAM Cache / Redis flushed successfully!");
    },
  }
};
