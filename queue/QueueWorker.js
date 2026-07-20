import Config from "../core/config.js";
import Queue from "./Queue.js";

class QueueWorker {
  constructor() {
    this.isRunning = false;
    this.activeCount = 0;
    this.timer = null;
  }

  /**
   * Starts the background queue worker process
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._loop();
  }

  /**
   * Stops the background queue worker process
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Internal recursive execution loop
   */
  async _loop() {
    if (!this.isRunning) return;

    try {
      const concurrency = parseInt(Config.get("QUEUE_CONCURRENCY")) || 2;
      const pollInterval = parseInt(Config.get("QUEUE_POLL_INTERVAL")) || 1000;

      while (this.activeCount < concurrency) {
        const job = await Queue.getNextJob();
        if (!job) {
          // No jobs ready for execution
          break;
        }

        // Process job asynchronously
        this._processJob(job);
      }

      // Schedule next polling interval
      if (this.isRunning) {
        this.timer = setTimeout(() => this._loop(), pollInterval);
        if (this.timer && typeof this.timer.unref === "function") {
          this.timer.unref();
        }
      }
    } catch (err) {
      console.error("❌ Queue Worker Loop Error:", err);
      // Retry worker loop setup after safe timeout delay
      if (this.isRunning) {
        this.timer = setTimeout(() => this._loop(), 5000);
        if (this.timer && typeof this.timer.unref === "function") {
          this.timer.unref();
        }
      }
    }
  }

  /**
   * Processes an individual job execution
   */
  async _processJob(job) {
    this.activeCount++;
    try {
      const handler = Queue.handlers.get(job.name);
      if (!handler) {
        throw new Error(`No handler registered for job type "${job.name}".`);
      }

      // Execute target job handler function
      await handler(job.data);

      // Success -> Remove job from queue
      await Queue.completeJob(job.id);
    } catch (err) {
      console.error(`❌ Queue Job #${job.id} ("${job.name}") failed:`, err.message);
      // Failure -> Handles automatic retries or permanent fail states
      await Queue.failJob(job.id, err.message);
    } finally {
      this.activeCount--;
      // Immediately run loops when a slot opens up to ensure rapid execution
      if (this.isRunning) {
        setImmediate(() => this._loop());
      }
    }
  }
}

export default new QueueWorker();
