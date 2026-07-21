import Config from "../core/config.js";
import MemoryCache from "../cache/MemoryCache.js";

class BehaviorAnalyzer {
  constructor() {
    this.history = new Map(); // ip -> { lastRequestTime: number, intervals: number[], consecutive404s: number }
    
    // Cleanup old histories every 5 minutes (TTL eviction)
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of this.history.entries()) {
            if (now - data.lastRequestTime > 300000) { // 5 minutes inactivity
                this.history.delete(ip);
            }
        }
    }, 300000);
    if (cleanup && typeof cleanup.unref === "function") {
      cleanup.unref();
    }
  }

  /**
   * Tracks a request and checks if the behavior is suspicious (e.g., bot/script regular intervals)
   * Returns { blocked: boolean, reason: string }
   */
  analyze(req, clientIp) {
    const isBotDetectionEnabled = Config.boolean("DETECT_BOT_BEHAVIOR", true);
    if (!isBotDetectionEnabled) {
      return { blocked: false };
    }

    // 1. Check for suspicious User-Agents (headless browsers or automated clients)
    const userAgent = String(req.headers["user-agent"] || "").toLowerCase();
    // Security/Usability: Removed curl and wget to allow DevOps tooling
    const suspiciousAgents = ["python-requests", "puppeteer", "playwright", "headlesschrome", "selenium"];
    for (const agent of suspiciousAgents) {
      if (userAgent.includes(agent)) {
        return {
          blocked: true,
          reason: `Suspicious client: Headless/Bot User-Agent detected (${agent})`
        };
      }
    }

    const now = Date.now();
    let data = this.history.get(clientIp);

    if (!data) {
      // Security: Bound the tracking map to prevent memory exhaustion
      if (this.history.size > 100000) {
        this.history.clear(); // Emergency flush
      }
      data = {
        lastRequestTime: now,
        intervals: [],
        consecutive404s: 0
      };
      this.history.set(clientIp, data);
      return { blocked: false };
    }

    // 1. Calculate time interval between current and last request
    const interval = now - data.lastRequestTime;
    data.lastRequestTime = now;

    // We only analyze intervals for fast requests (less than 3 seconds apart)
    if (interval < 3000) {
      data.intervals.push(interval);
      // Keep only last 10 intervals
      if (data.intervals.length > 10) {
        data.intervals.shift();
      }
    }

    // 2. Check for extreme interval regularity (signature of loop/bot scripts)
    if (data.intervals.length >= 6) {
      const average = data.intervals.reduce((a, b) => a + b, 0) / data.intervals.length;
      const variance = data.intervals.reduce((a, b) => a + Math.pow(b - average, 2), 0) / data.intervals.length;
      const stdDeviation = Math.sqrt(variance);

      // A human has natural delay variations (high standard deviation).
      // A script has extremely low std deviation (usually < 15ms jitter)
      const minJitter = parseInt(Config.get("BOT_MIN_JITTER")) || 15;
      if (stdDeviation < minJitter && average < 1000) {
        return {
          blocked: true,
          reason: `Bot pattern detected: Extreme request regularity (Jitter: ${stdDeviation.toFixed(2)}ms)`
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Tracks response status codes, checking if an IP is brute-forcing/scanning non-existent routes
   */
  trackResponse(clientIp, statusCode) {
    if (statusCode === 404) {
      let data = this.history.get(clientIp);
      if (data) {
        data.consecutive404s++;
        const max404s = parseInt(Config.get("MAX_CONSECUTIVE_404S")) || 15;
        if (data.consecutive404s >= max404s) {
          const autoBlockDuration = parseInt(Config.get("AUTO_BLOCK_DURATION")) || 300;
          MemoryCache.set("temp_blocked_ip:" + clientIp, true, autoBlockDuration);
          console.warn(`⚠️ IP ${clientIp} temporarily blocked for ${autoBlockDuration}s due to rapid 404 route scanning (${data.consecutive404s} failures).`);
          this.history.delete(clientIp);
        }
      }
    } else if (statusCode >= 200 && statusCode < 300) {
      // Reset failure count on successful requests
      let data = this.history.get(clientIp);
      if (data) {
        data.consecutive404s = 0;
      }
    }
  }

  reset(clientIp) {
    if (clientIp) {
      this.history.delete(clientIp);
    } else {
      this.history.clear();
    }
  }
}

export default new BehaviorAnalyzer();
