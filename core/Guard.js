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

import { requestContext } from "./Context.js";
import Config from "./config.js";

function protect() {
    const store = requestContext.getStore();
    if (store && store.response && !store.response.headersSent) {
        store.response.writeHead(404, { "Content-Type": "text/plain" });
        store.response.end("404 Not Found");
        throw new Error("VEXORA_ROUTE_BLOCKED");
    }
}

function check(req, res) {
    if (Config.boolean("EMERGENCY_BLOCK", false)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain");
        res.end("404 Not Found");
        return false;
    }
    return true;
}

export default {
    protect,
    check,
    get enabled() {
        return true; 
    }
};