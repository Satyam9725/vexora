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

import crypto from "crypto";
import Config from "../core/config.js";
import { requestContext } from "../core/Context.js";
import { base64UrlEncode, base64UrlDecode } from "./vault/Base64Url.js";
import { encryptPayload, decryptPayload } from "./vault/Cipher.js";
import MemoryCache from "../cache/MemoryCache.js";

const CONTEXT = "APP-TOKEN-VAULT-V1";
const CLOCK_SKEW = 30;
const MAX_UKEY_LEN = 256;
const MAX_TOKEN_LEN = 8192;

class TokenVault {
    constructor() {
        this.masterKeys = {};
        this.issuer = "APP-DEFAULT-ISS";
        this.audience = "APP-DEFAULT-AUD";
    }

    configure(keys, iss = "APP-DEFAULT-ISS", aud = "APP-DEFAULT-AUD") {
        if (!keys || Object.keys(keys).length === 0) {
            throw new Error("Vault configuration failed: Keys missing.");
        }

        this.issuer = iss;
        this.audience = aud;
        const normalized = {};

        for (const [kid, key] of Object.entries(keys)) {
            if (typeof key !== "string" || key.trim() === "") {
                throw new Error("Vault configuration failed: Invalid key format.");
            }
            if (key.length < 16) {
                throw new Error("Vault configuration failed: Master key too short.");
            }
            normalized[kid] = crypto.hkdfSync("sha256", key, Buffer.alloc(0), CONTEXT + kid, 32);
        }
        this.masterKeys = normalized;
    }

    _getActiveKid() {
        const keys = Object.keys(this.masterKeys);
        return keys[keys.length - 1];
    }

    _deriveKey(master, uKey) {
        if (uKey.length > MAX_UKEY_LEN) {
            throw new Error("Validation failed: uKey exceeds maximum allowed length.");
        }
        return crypto.hkdfSync("sha256", master, Buffer.alloc(0), CONTEXT + uKey.trim(), 32);
    }

    ttl(duration) {
        const d = String(duration).trim().toUpperCase();
        if (d === "" || d === "0") return 0;
        const unit = d.slice(-1);
        const val = parseInt(d.slice(0, -1), 10);
        if (isNaN(val) || val <= 0) return 0;

        switch (unit) {
            case "S": return val;
            case "M": return val * 60;
            case "H": return val * 3600;
            case "D": return val * 86400;
            case "W": return val * 604800;
            case "MO": return val * 2592000;
            case "Y": return val * 31536000;
            default: return 0;
        }
    }

    _getClientContext() {
        const store = requestContext.getStore();
        if (!store || !store.req) return { sid: null, ip: null, ua: null };
        const req = store.req;
        const sid = store.sessionId || null;
        const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "0.0.0.0";
        const ua = req.headers["user-agent"] || "";
        return { sid, ip, ua };
    }

    _ensureConfigured() {
        if (Object.keys(this.masterKeys).length === 0) {
            const secret = Config.get("AES_SECRET") || "DefaultMasterSecretKey16BytesMin";
            this.configure({ v1: secret });
        }
    }

    seal(payload, uKey, duration = "1H", purpose = "auth", nbfOffset = 0, bindSession = false, bindIp = false, bindDevice = false, maxUses = 0) {
        try {
            this._ensureConfigured();
            if (typeof uKey !== "string" || uKey.trim() === "") throw new Error("Invalid uKey.");

            const kid = this._getActiveKid();
            const masterKey = this.masterKeys[kid];
            const derivedKey = this._deriveKey(masterKey, uKey);

            const now = Math.floor(Date.now() / 1000);
            const ttlSeconds = this.ttl(duration);
            const exp = ttlSeconds > 0 ? now + ttlSeconds : 0;
            const nbf = nbfOffset > 0 ? now + nbfOffset : 0;

            const client = this._getClientContext();
            const jti = crypto.randomUUID();

            const fullPayload = {
                jti: jti,
                data: payload,
                iss: this.issuer,
                aud: this.audience,
                prp: purpose,
                iat: now,
                nbf: nbf,
                exp: exp,
                max: maxUses,
                sid: bindSession ? client.sid : null,
                ip: bindIp ? client.ip : null,
                ua: bindDevice ? client.ua : null
            };

            const jsonStr = JSON.stringify(fullPayload);
            const rawCipher = encryptPayload(derivedKey, kid, jsonStr);
            const token = kid + "." + base64UrlEncode(rawCipher);

            return { status: true, token, jti, exp };
        } catch (e) {
            return { status: false, error: e.message };
        }
    }

    unseal(token, uKey, expectedPurpose = "auth") {
        try {
            this._ensureConfigured();
            if (token.length > MAX_TOKEN_LEN) throw new Error("Maximum token length exceeded.");
            if (!token.includes(".")) throw new Error("Malformed token structure.");

            const parts = token.split(".");
            const kid = parts[0];
            const payloadEncoded = parts.slice(1).join(".");

            if (!this.masterKeys[kid]) throw new Error("Unrecognized key identifier: " + kid);

            const raw = base64UrlDecode(payloadEncoded);
            if (!raw || raw.length === 0) throw new Error("Invalid base64url encoding.");

            const key = this._deriveKey(this.masterKeys[kid], uKey);
            const jsonStr = decryptPayload(key, kid, raw);
            const payload = JSON.parse(jsonStr);

            const now = Math.floor(Date.now() / 1000);
            if (payload.iss !== this.issuer) throw new Error("Issuer mismatch.");
            if (payload.aud !== this.audience) throw new Error("Audience mismatch.");
            if (payload.prp !== expectedPurpose) throw new Error("Purpose mismatch.");
            if (payload.nbf && now + CLOCK_SKEW < payload.nbf) throw new Error("Token not yet active.");
            if (payload.exp && now - CLOCK_SKEW > payload.exp) throw new Error("Token expired.");

            const client = this._getClientContext();
            if (payload.sid && payload.sid !== client.sid) throw new Error("Session binding validation failed.");
            if (payload.ip && payload.ip !== client.ip) throw new Error("IP binding validation failed.");
            if (payload.ua && payload.ua !== client.ua) throw new Error("Device binding validation failed.");

            // Check usage limit
            if (payload.jti && payload.max && payload.max > 0) {
                const cacheKey = `jti_uses:${payload.jti}`;
                const currentUses = MemoryCache.get(cacheKey, 0);

                if (currentUses >= payload.max) {
                    throw new Error("Token usage limit exceeded.");
                }

                const ttl = payload.exp ? Math.max(1, payload.exp - now) : 86400;
                MemoryCache.set(cacheKey, currentUses + 1, ttl);
            }

            return { status: true, data: payload.data, claims: payload };
        } catch (e) {
            return { status: false, error: e.message };
        }
    }
}

export default new TokenVault();
