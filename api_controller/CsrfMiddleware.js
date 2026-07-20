/**
 * ==========================================================
 * Vexora Framework - CSRF Protection Middleware
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

import crypto from "crypto";
import Helper from "../utils/Helper.js";
import TokenVault from "../security/TokenVault.js";

// Default settings
let config = {
    cookieName: "XSRF-TOKEN",
    headerName: "x-csrf-token",
    paramName: "_token",
    cookieOptions: { httpOnly: false, secure: true, sameSite: "Lax", path: "/" },
    excludePaths: []
};

class CsrfMiddleware {
    /**
     * Generates a device-bound, session-bound, IP-bound CSRF token
     */
    static generate(options = {}) {
        const bindDevice = options.bindDevice !== undefined ? Boolean(options.bindDevice) : true;
        const bindIp = options.bindIp !== undefined ? Boolean(options.bindIp) : false;
        const bindSession = options.bindSession !== undefined ? Boolean(options.bindSession) : false;
        const maxUses = options.maxUses !== undefined ? parseInt(options.maxUses, 10) : 1;
        const ttl = options.ttl || "1H";

        const payload = { type: "csrf", iat: Math.floor(Date.now() / 1000) };
        const sealed = TokenVault.seal(payload, "csrf_vault", ttl, "csrf", 0, bindSession, bindIp, bindDevice, maxUses);
        return sealed.token;
    }

    /**
     * Verifies a CSRF token with timing-attack safety & device/IP/session checks
     */
    static verify(clientToken, serverToken = null) {
        if (!clientToken) return false;

        // Direct timing-safe comparison if serverToken is provided
        if (serverToken) {
            try {
                const bufA = Buffer.from(String(clientToken).trim());
                const bufB = Buffer.from(String(serverToken).trim());
                if (bufA.length !== bufB.length) return false;
                return crypto.timingSafeEqual(bufA, bufB);
            } catch {
                return false;
            }
        }

        // Sealed TokenVault CSRF verification (Device, IP, Session, Expiry, Max Uses)
        const unseal = TokenVault.unseal(String(clientToken).trim(), "csrf_vault", "csrf");
        return Boolean(unseal && unseal.status);
    }

    /**
     * Configure CSRF Protection Options
     * 
     * @param {Object} options Configuration options
     */
    static configure(options = {}) {
        if (options.cookieName) config.cookieName = options.cookieName;
        if (options.headerName) config.headerName = options.headerName;
        if (options.paramName) config.paramName = options.paramName;
        if (options.cookieOptions) config.cookieOptions = { ...config.cookieOptions, ...options.cookieOptions };
        if (Array.isArray(options.excludePaths)) config.excludePaths = options.excludePaths;
    }

    /**
     * Regenerates/Rotates the CSRF token in the request session
     * 
     * @param {Object} req Vexora Request
     * @returns {string} The newly generated token
     */
    static rotate(req) {
        return Helper.generateCsrfToken(req);
    }

    /**
     * Handles CSRF verification and token distribution
     * 
     * @param {Object} req Node.js http.IncomingMessage or Vexora Request
     * @param {Object} res Node.js http.ServerResponse or Vexora Response
     * @returns {boolean} Returns true if the request was blocked with 403 Forbidden
     */
    static handle(req, res) {
        const method = req.method ? req.method.toUpperCase() : "GET";
        const path = req.path || "";

        // Check path exclusions
        const isExcluded = config.excludePaths.some(p => {
            if (p instanceof RegExp) {
                return p.test(path);
            }
            return path.startsWith(p);
        });

        if (isExcluded) {
            return false; // Skip CSRF check for excluded paths
        }
        
        // 1. Safe HTTP methods: Distribute/initialize token
        if (["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
            try {
                // Initialize request session (lazy loaded)
                const session = req.session;
                if (session) {
                    let token = session._csrf;
                    if (!token) {
                        token = Helper.generateCsrfToken(req);
                    }
                    
                    // Set token header
                    const formattedHeader = config.headerName;
                    if (typeof res.header === "function") {
                        res.header(formattedHeader, token);
                    } else if (typeof res.setHeader === "function") {
                        res.setHeader(formattedHeader, token);
                    }
                    
                    // Set client-accessible CSRF cookie
                    if (typeof res.cookie === "function") {
                        res.cookie(config.cookieName, token, config.cookieOptions);
                    }
                }
            } catch (err) {
                console.warn("⚠️ CSRF Middleware session tracking error:", err.message);
            }
            return false; // Proceed safely
        }

        // 2. Unsafe/State-changing HTTP methods: Verify Token
        if (!Helper.verifyCsrfToken(req, config.paramName, config.headerName)) {
            if (typeof res.error === "function") {
                res.error("CSRF Token Invalid or Missing", 403);
            } else {
                res.statusCode = 403;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ status: false, message: "CSRF Token Invalid or Missing" }));
            }
            return true; // Block request execution
        }

        return false; // Valid CSRF token, proceed
    }
}

export default CsrfMiddleware;
