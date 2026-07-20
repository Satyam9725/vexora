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

let enabled = false;
let mode = "full"; // "full" or "browser"

function protect(targetMode = "full") {
    enabled = true;
    const normalized = String(targetMode).toLowerCase().trim();
    if (normalized === "browser" || normalized === "url") {
        mode = "browser";
    } else {
        mode = "full";
    }
}

function check(req, res) {
    if (!enabled) {
        return true;
    }

    if (mode === "browser") {
        // Determine if it is a direct browser navigation (HTML page load)
        const secFetchMode = req.headers['sec-fetch-mode'];
        const secFetchDest = req.headers['sec-fetch-dest'];
        const accept = req.headers['accept'] || '';

        const isBrowserNavigation = 
            secFetchMode === 'navigate' || 
            secFetchDest === 'document' ||
            (accept.includes('text/html') && !accept.includes('application/json'));

        // Bypass lockdown if requested programmatically (e.g. API call, XHR, fetch)
        if (!isBrowserNavigation) {
            return true;
        }
    }

    // Default: Block all requests (Full Lockdown mode)
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end("404 Not Found");

    return false;
}

export default {
    protect,
    check,
    get enabled() {
        return enabled;
    }
};