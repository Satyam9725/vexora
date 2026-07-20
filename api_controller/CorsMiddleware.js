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

class CorsMiddleware {
    /**
     * Adds CORS and API Security Headers to the response
     * 
     * @param {Object} req Node.js http.IncomingMessage or Nyvora Request
     * @param {Object} res Node.js http.ServerResponse or Nyvora Response
     * @param {string|Array} allowedOrigins Allowed origin list or "*" for all origins.
     * @returns {boolean} Returns true if OPTIONS preflight request was handled.
     */
    static handle(req, res, allowedOrigins = '*') {
        const nativeRes = res.res || res;
        const nativeReq = req.req || req;

        // API Security Headers
        nativeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
        nativeRes.setHeader('X-Content-Type-Options', 'nosniff');
        nativeRes.setHeader('X-Frame-Options', 'DENY');
        nativeRes.setHeader('Referrer-Policy', 'no-referrer');
        nativeRes.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        nativeRes.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        nativeRes.setHeader('Pragma', 'no-cache');
        nativeRes.setHeader('Expires', '0');

        // CORS Origin Handling
        if (allowedOrigins === '*') {
            nativeRes.setHeader('Access-Control-Allow-Origin', '*');
        } else {
            const origin = (nativeReq.headers && nativeReq.headers['origin']) || '';
            const originsList = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];

            if (originsList.includes(origin)) {
                nativeRes.setHeader('Access-Control-Allow-Origin', origin);
                nativeRes.setHeader('Access-Control-Allow-Credentials', 'true');
                nativeRes.setHeader('Vary', 'Origin');
            }
        }

        // Allowed HTTP Methods & Headers
        nativeRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        nativeRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');

        // Automatically handle HTTP OPTIONS Preflight Request
        if (nativeReq.method === 'OPTIONS') {
            nativeRes.statusCode = 204;
            nativeRes.end();
            return true;
        }

        return false;
    }
}

export default CorsMiddleware;
