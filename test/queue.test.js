import assert from "assert";
import Vexora from "../Vexora.js";
import Config from "../core/config.js";

export async function run() {
    console.log("👉 Running Queue & Background Jobs Tests...");

    // Disable auto-start on server initialization for testing so we can control worker manually
    const originalAutoStart = Config.get("QUEUE_AUTO_START");
    const originalDriver = Config.get("QUEUE_DRIVER");
    const originalPoll = Config.get("QUEUE_POLL_INTERVAL");
    const originalRetryDelay = Config.get("QUEUE_RETRY_DELAY");
    
    Config.set("QUEUE_AUTO_START", "false");
    Config.set("QUEUE_POLL_INTERVAL", "100");
    Config.set("QUEUE_RETRY_DELAY", "50");

    try {
        // --- 1. Memory Driver Tests ---
        Config.set("QUEUE_DRIVER", "memory");
        await Vexora.Queue.clear();
        Vexora.QueueWorker.stop();

        let runCount1 = 0;
        let lastPayload1 = null;

        // Define a simple job
        Vexora.Queue.define("test-job-1", async (data) => {
            runCount1++;
            lastPayload1 = data;
        });

        // Dispatch job
        await Vexora.Queue.dispatch("test-job-1", { val: "hello" });
        
        // Before worker starts, verify job is queued
        assert.strictEqual(Vexora.Queue.memoryQueue.length, 1, "Job should be in memory queue");
        assert.strictEqual(Vexora.Queue.memoryQueue[0].status, "queued");

        // Start worker, process job, verify completion
        Vexora.QueueWorker.start();
        await new Promise((resolve) => setTimeout(resolve, 300));
        Vexora.QueueWorker.stop();

        assert.strictEqual(runCount1, 1, "Job handler should have run once");
        assert.deepStrictEqual(lastPayload1, { val: "hello" }, "Payload should match");
        assert.strictEqual(Vexora.Queue.memoryQueue.length, 0, "Memory queue should be empty after job completion");

        // --- 2. Delayed Job Tests ---
        await Vexora.Queue.clear();
        let runCount2 = 0;
        Vexora.Queue.define("test-job-2", async () => {
            runCount2++;
        });

        // Dispatch with 150ms delay
        await Vexora.Queue.dispatch("test-job-2", {}, { delay: 150 });
        Vexora.QueueWorker.start();

        // Check immediately - should not have run yet
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.strictEqual(runCount2, 0, "Delayed job should not execute immediately");

        // Check after delay has elapsed
        await new Promise((resolve) => setTimeout(resolve, 200));
        Vexora.QueueWorker.stop();
        assert.strictEqual(runCount2, 1, "Delayed job should execute after delay elapsed");

        // --- 3. Retry Attempts on Error Tests ---
        await Vexora.Queue.clear();
        let runCount3 = 0;
        Vexora.Queue.define("failing-job", async () => {
            runCount3++;
            throw new Error("Temporary DB Connection Failure");
        });

        // Dispatch job with 3 attempts limit
        await Vexora.Queue.dispatch("failing-job", {}, { attempts: 3 });
        
        Vexora.QueueWorker.start();
        // Wait long enough for attempts and retry delay to run
        await new Promise((resolve) => setTimeout(resolve, 400));
        Vexora.QueueWorker.stop();

        // 1st run + 2 retries = 3 attempts total
        assert.strictEqual(runCount3, 3, "Job should retry up to 3 times before failing permanently");

        // --- 4. Cache/MemoryCache Driver Tests ---
        Config.set("QUEUE_DRIVER", "cache");
        await Vexora.Queue.clear();
        
        let runCount4 = 0;
        Vexora.Queue.define("cache-job", async (data) => {
            runCount4++;
        });

        await Vexora.Queue.dispatch("cache-job", { key: "cache-val" });

        // Verify it was stored in Vexora Cache mock
        const jobIds = await Vexora.Cache.get("queue_job_ids");
        assert.ok(jobIds && jobIds.length === 1, "Job ID should be saved in queue list key");

        const cachedJob = await Vexora.Cache.get(`queue_job:${jobIds[0]}`);
        assert.strictEqual(cachedJob.name, "cache-job", "Job details should be serialized in cache");

        Vexora.QueueWorker.start();
        await new Promise((resolve) => setTimeout(resolve, 300));
        Vexora.QueueWorker.stop();

        assert.strictEqual(runCount4, 1, "Cache driver job should execute successfully");

        const jobIdsAfter = await Vexora.Cache.get("queue_job_ids");
        assert.strictEqual(jobIdsAfter.length, 0, "Cache job list should be empty after run");

        console.log("✅ Queue & Background Jobs Tests Passed.\n");
    } finally {
        Vexora.QueueWorker.stop();
        Config.set("QUEUE_AUTO_START", originalAutoStart);
        Config.set("QUEUE_DRIVER", originalDriver);
        Config.set("QUEUE_POLL_INTERVAL", originalPoll);
        Config.set("QUEUE_RETRY_DELAY", originalRetryDelay);
        await Vexora.Queue.clear();
    }
}
