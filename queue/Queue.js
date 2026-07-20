import Config from "../core/config.js";
import MemoryCache from "../cache/MemoryCache.js";

class QueueManager {
  constructor() {
    this.handlers = new Map(); // name -> handler function
    this.memoryQueue = [];     // Array of jobs for 'memory' driver
    this.activeWorkers = new Set();
  }

  /**
   * Define a job handler
   * 
   * @param {string} name - Name of the job
   * @param {Function} handler - Handler function that executes when the job runs
   */
  define(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`Queue handler for job "${name}" must be a function.`);
    }
    this.handlers.set(name, handler);
  }

  /**
   * Dispatch a job to the queue
   * 
   * @param {string} name - Name of the job
   * @param {Object} data - Payload data for the job
   * @param {Object} [options] - Optional settings
   * @param {number} [options.delay=0] - Delay in milliseconds before executing the job
   * @param {number} [options.attempts=1] - Max execution attempts
   * @returns {Promise<Object>} The dispatched job object
   */
  async dispatch(name, data, options = {}) {
    if (!this.handlers.has(name)) {
      console.warn(`⚠️ Warning: Dispatching job "${name}" which has no handler defined yet.`);
    }

    const driver = (Config.get("QUEUE_DRIVER") || "memory").toLowerCase();
    const delay = parseInt(options.delay) || 0;
    const attempts = parseInt(options.attempts) || 1;

    const job = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name,
      data,
      attempts,
      attemptsMade: 0,
      createdAt: Date.now(),
      runAt: Date.now() + delay,
      status: "queued",
      error: null
    };

    if (driver === "redis" || driver === "cache") {
      // Save job details in MemoryCache (Redis simulation)
      await MemoryCache.set(`queue_job:${job.id}`, job);
      // Append job ID to the jobs list
      const jobIds = (await MemoryCache.get("queue_job_ids")) || [];
      jobIds.push(job.id);
      await MemoryCache.set("queue_job_ids", jobIds);
    } else {
      // Memory driver fallback
      this.memoryQueue.push(job);
    }

    return job;
  }

  /**
   * Fetches the next available job that is ready to execute
   */
  async getNextJob() {
    const driver = (Config.get("QUEUE_DRIVER") || "memory").toLowerCase();
    const now = Date.now();

    if (driver === "redis" || driver === "cache") {
      const jobIds = (await MemoryCache.get("queue_job_ids")) || [];
      if (jobIds.length === 0) return null;

      for (let i = 0; i < jobIds.length; i++) {
        const jobId = jobIds[i];
        const job = await MemoryCache.get(`queue_job:${jobId}`);
        if (job && job.status === "queued" && job.runAt <= now) {
          // Mark job as processing
          job.status = "processing";
          await MemoryCache.set(`queue_job:${jobId}`, job);
          return job;
        }
      }
    } else {
      // Memory driver
      for (let i = 0; i < this.memoryQueue.length; i++) {
        const job = this.memoryQueue[i];
        if (job.status === "queued" && job.runAt <= now) {
          job.status = "processing";
          return job;
        }
      }
    }
    return null;
  }

  /**
   * Marks a job as completed and deletes/updates it
   */
  async completeJob(jobId) {
    const driver = (Config.get("QUEUE_DRIVER") || "memory").toLowerCase();

    if (driver === "redis" || driver === "cache") {
      // Delete job details and remove from list
      await MemoryCache.del(`queue_job:${jobId}`);
      const jobIds = (await MemoryCache.get("queue_job_ids")) || [];
      const index = jobIds.indexOf(jobId);
      if (index !== -1) {
        jobIds.splice(index, 1);
        await MemoryCache.set("queue_job_ids", jobIds);
      }
    } else {
      // Memory driver
      const index = this.memoryQueue.findIndex(j => j.id === jobId);
      if (index !== -1) {
        this.memoryQueue.splice(index, 1);
      }
    }
  }

  /**
   * Handles job failure, updating retry attempts or marking as failed
   */
  async failJob(jobId, errorMsg) {
    const driver = (Config.get("QUEUE_DRIVER") || "memory").toLowerCase();

    if (driver === "redis" || driver === "cache") {
      const job = await MemoryCache.get(`queue_job:${jobId}`);
      if (job) {
        job.attemptsMade++;
        job.error = errorMsg;

        if (job.attemptsMade < job.attempts) {
          // Retry - delay next run slightly (delay * attempt index)
          const retryDelay = parseInt(Config.get("QUEUE_RETRY_DELAY")) || 1000;
          job.status = "queued";
          job.runAt = Date.now() + (job.attemptsMade * retryDelay);
          await MemoryCache.set(`queue_job:${jobId}`, job);
        } else {
          // Attempts exhausted -> Permanent failure
          job.status = "failed";
          await MemoryCache.set(`queue_job:${jobId}`, job);
          
          // Remove from active job list but keep metadata (optional)
          const jobIds = (await MemoryCache.get("queue_job_ids")) || [];
          const index = jobIds.indexOf(jobId);
          if (index !== -1) {
            jobIds.splice(index, 1);
            await MemoryCache.set("queue_job_ids", jobIds);
          }
        }
      }
    } else {
      // Memory driver
      const job = this.memoryQueue.find(j => j.id === jobId);
      if (job) {
        job.attemptsMade++;
        job.error = errorMsg;

        if (job.attemptsMade < job.attempts) {
          const retryDelay = parseInt(Config.get("QUEUE_RETRY_DELAY")) || 1000;
          job.status = "queued";
          job.runAt = Date.now() + (job.attemptsMade * retryDelay);
        } else {
          job.status = "failed";
          const index = this.memoryQueue.findIndex(j => j.id === jobId);
          if (index !== -1) {
            this.memoryQueue.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * Reset / clear the queues (for test teardowns)
   */
  async clear() {
    this.memoryQueue = [];
    const driver = (Config.get("QUEUE_DRIVER") || "memory").toLowerCase();
    if (driver === "redis" || driver === "cache") {
      const jobIds = (await MemoryCache.get("queue_job_ids")) || [];
      for (const id of jobIds) {
        await MemoryCache.del(`queue_job:${id}`);
      }
      await MemoryCache.del("queue_job_ids");
    }
  }
}

export default new QueueManager();
