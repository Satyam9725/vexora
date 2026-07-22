/**
 * Vexora Framework - Queue Commands
 */

import { line } from "./helpers.js";

export const queueCommands = {
  "queue:status": {
    description: "Displays background job queue health & stats",
    category: "📦 Queue",
    async run() {
      const Queue = (await import("../queue/Queue.js")).default;
      line();
      console.log("📦 VEXORA BACKGROUND QUEUE STATUS");
      line();
      console.log(`  • Registered Handlers : ${Queue.handlers.size}`);
      console.log(`  • Memory Queue Jobs   : ${Queue.memoryQueue.length}`);
      console.log(`  • Active Workers      : ${Queue.activeWorkers.size}`);
      line();
    },
  }
};
