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
import Config from "../../core/config.js";

export async function parseBody(req) {
    req.body = {};
    req.rawBody = "";

    if (req.method === 'GET' || req.method === 'HEAD') {
        return;
    }

    const maxLimitMb = parseFloat(Config.get("MAX_BODY_SIZE_MB")) || 10;
    const maxLimitBytes = maxLimitMb * 1024 * 1024;

    return new Promise((resolve) => {
        let bodyData = [];
        let accumulatedBytes = 0;
        let limitExceeded = false;

        req.on('data', chunk => {
            if (limitExceeded) return;
            accumulatedBytes += chunk.length;
            if (accumulatedBytes > maxLimitBytes) {
                limitExceeded = true;
                req.bodyLimitExceeded = true;
                resolve();
                return;
            }
            bodyData.push(chunk);
        });

        req.on('end', () => {
            if (limitExceeded) {
                return;
            }
            req.rawBody = Buffer.concat(bodyData).toString();
            const contentType = req.headers['content-type'] || '';
            
            if (contentType.includes('application/json')) {
                try { req.body = JSON.parse(req.rawBody); } catch(e) {}
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(req.rawBody);
                for (const [k, v] of params.entries()) {
                    req.body[k] = v;
                }
            }
            resolve();
        });
    });
}
