import Config from "../../core/config.js";
import Helper from "../../utils/Helper.js";

class Recaptcha {
  /**
   * Verify reCAPTCHA or Turnstile Token against provider API
   * 
   * @param {string} token - The token submitted by the frontend client
   * @param {string} [provider] - 'google' (reCAPTCHA) or 'turnstile' (Cloudflare Turnstile)
   * @param {string} [customSecret] - Optional override for secret key
   * @param {string} [remoteIp] - Optional client remote IP address
   * @returns {Promise<Object>} Verification response details { success: boolean, score: number, hostname: string, errorCodes: string[] }
   */
  async verify(token, provider = null, customSecret = null, remoteIp = null) {
    if (!token) {
      return { success: false, errorCodes: ["missing-input-response"] };
    }

    const selectedProvider = (provider || Config.get("CAPTCHA_PROVIDER") || "google").toLowerCase();
    const secret = customSecret || Config.get("RECAPTCHA_SECRET") || Config.get("CAPTCHA_SECRET");

    if (!secret) {
      throw new Error("CAPTCHA verification failed: Secret key not configured. Set RECAPTCHA_SECRET or CAPTCHA_SECRET in .Vexora/config");
    }

    const endpoint = selectedProvider === "google"
      ? "https://www.google.com/recaptcha/api/siteverify"
      : "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (remoteIp) {
      params.append("remoteip", remoteIp);
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });

      if (!res.ok) {
        return { success: false, errorCodes: ["http-communication-error"] };
      }

      const data = await res.json();
      return {
        success: !!data.success,
        score: data.score !== undefined ? data.score : null,
        hostname: data.hostname || null,
        errorCodes: data["error-codes"] || [],
        raw: data
      };
    } catch (err) {
      return { success: false, errorCodes: ["network-error"], errorMsg: err.message };
    }
  }

  /**
   * Vexora Middleware wrapper for CAPTCHA verification
   * 
   * @param {Object} [options]
   * @param {string} [options.tokenField='captcha_token'] - Request parameter name for token
   * @param {string} [options.headerName='x-captcha-token'] - Header name for token
   * @param {string} [options.provider] - CAPTCHA provider override
   * @returns {Function} Middleware handler function (req, res) -> Promise<boolean> (true if blocked, false if proceed)
   */
  middleware(options = {}) {
    const tokenField = options.tokenField || "captcha_token";
    const headerName = options.headerName || "x-captcha-token";
    const provider = options.provider || null;

    return async (req, res) => {
      let token = null;
      if (typeof req.input === "function") {
        token = req.input(tokenField);
      } else {
        token = (req.body && req.body[tokenField]) || (req.query && req.query[tokenField]);
      }

      if (!token && req.headers) {
        token = req.headers[headerName.toLowerCase()];
      }

      if (!token) {
        res.writeHead(422, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ status: false, message: "CAPTCHA token is required" }));
        return true; // Block request
      }

      const clientIp = Helper.getClientIp(req);
      const result = await this.verify(token, provider, null, clientIp);

      if (!result.success) {
        res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ status: false, message: "CAPTCHA verification failed", errors: result.errorCodes }));
        return true; // Block request
      }

      req.captcha = result; // Attach result for controller access
      return false; // Proceed
    };
  }
}

export default new Recaptcha();
