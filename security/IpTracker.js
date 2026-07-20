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

import fs from "fs";
import path from "path";
import { requestContext } from "../core/Context.js";
import { MutexQueue } from "./iptracker/MutexQueue.js";
import Helper from "../utils/Helper.js";

class IpTracker {
    constructor(enabled = true, prefix = 'ip_visits', directory = null) {
        this.enabled = enabled;
        if (!enabled) return;

        this.directory = directory || path.join(process.cwd(), '.Vexora', 'logs', 'ip_tracker');
        this.prefix = prefix;
        this.mutex = new MutexQueue();
    }

    _getStorageFile() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.directory, `${this.prefix}_${date}.json`);
    }

    getRealIp() {
        const store = requestContext.getStore();
        const req = store ? store.req : null;
        return Helper.getClientIp(req);
    }

    recordVisit(ignoreLocalhost = false) {
        if (!this.enabled) return Promise.resolve(false);

        const ip = this.getRealIp();

        if (ignoreLocalhost && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
            return Promise.resolve(false);
        }

        const now = new Date().toISOString();
        const file = this._getStorageFile();

        return this.mutex.enqueue(async () => {
            let data = {};

            try {
                await fs.promises.mkdir(this.directory, { recursive: true });
            } catch (err) {
                // Ignore error if directory already exists
            }

            try {
                const content = await fs.promises.readFile(file, 'utf8');
                if (content.trim() !== '') {
                    data = JSON.parse(content);
                }
            } catch (err) {
                // Ignore error if file doesn't exist yet
                data = {};
            }

            if (!data[ip]) {
                data[ip] = {
                    visits: 1,
                    first_visit: now,
                    last_visit: now
                };
            } else {
                data[ip].visits = (data[ip].visits || 0) + 1;
                data[ip].last_visit = now;
            }

            await fs.promises.writeFile(file, JSON.stringify(data, null, 4), 'utf8');
            return true;
        });
    }

    getData() {
        if (!this.enabled) return {};
        const file = this._getStorageFile();
        if (!fs.existsSync(file)) return {};

        try {
            const content = fs.readFileSync(file, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            return {};
        }
    }

    getUniqueVisitors() {
        return Object.keys(this.getData()).length;
    }

    getTotalVisits() {
        let total = 0;
        const data = this.getData();
        for (const key in data) {
            total += (data[key].visits || 0);
        }
        return total;
    }

    clearToday() {
        if (!this.enabled) return false;
        const file = this._getStorageFile();
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            return true;
        }
        return false;
    }
}

export default new IpTracker();
