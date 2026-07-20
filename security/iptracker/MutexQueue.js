/**
 * ==========================================================
 * Nyvora Framework
 * ==========================================================
 *
 * @author      Satyam Kumar
 * @email       satyam.ku9725@gmail.com
 * @phone       +91 9725399936
 * @github      https://github.com/Satyam9725
 *
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 *
 * ==========================================================
 */

export class MutexQueue {
    constructor() {
        this.queue = Promise.resolve();
    }

    enqueue(task) {
        this.queue = this.queue.then(() => task().catch(err => {
            console.error("[IpTracker] Write Task Error:", err);
        }));
        return this.queue;
    }
}
