/**
 * ==========================================================
 * Vexora Framework - Global Response
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

import { requestContext } from "../core/Context.js";
import { performance } from "node:perf_hooks";

class GlobalResponse {
    static _getRes() {
        const store = requestContext.getStore();
        if (!store || !store.response) {
            throw new Error("Request context not found. Ensure this is called within a route handler.");
        }
        return store.response;
    }

    static json(status, message = '', data = null, httpCode = 200) {
        const store = requestContext.getStore();
        const res = store ? store.response : this._getRes();
        
        let executionTime = "0.00ms";
        if (store && store.req && store.req.startTime) {
            executionTime = `${(performance.now() - store.req.startTime).toFixed(2)}ms`;
        }

        return res.status(httpCode).json({
            status: status,
            message: message,
            data: data,
            execution_time: executionTime
        });
    }

    static success(data = null, message = 'Success') {
        return this.json(true, message, data, 200);
    }

    static error(message = 'Error', httpCode = 400, data = null) {
        return this.json(false, message, data, httpCode);
    }
}

export default GlobalResponse;
