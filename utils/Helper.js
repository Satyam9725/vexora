"use strict";

/**
 * ==========================================================
 * Vexora Framework - Utility Helper Suite
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

import crypto from "node:crypto";
import Config from "../core/config.js";

const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

import BcryptEngine from "../security/Bcrypt.js";

class Helper {
  /* ================= PASSWORD HASHING (PHP-COMPATIBLE BCRYPT $2y$) ================= */

  /**
   * Generates a PHP-compatible $2y$ Bcrypt password hash
   * Example: $2y$10$e8w.x.s62Gj77p0P0...
   */
  static hashPassword(password, cost = 10) {
    if (!password) throw new Error("Password cannot be empty");
    return BcryptEngine.hash(password, cost, "$2y$");
  }

  /**
   * Verifies a password against a $2y$ / $2b$ / $2a$ Bcrypt or Scrypt hash
   */
  static verifyPassword(password, hashedPassword) {
    if (!password || !hashedPassword) return false;

    // Check if hash is $2y$ / $2b$ / $2a$ Bcrypt format
    if (hashedPassword.startsWith("$2a$") || hashedPassword.startsWith("$2b$") || hashedPassword.startsWith("$2y$")) {
      return BcryptEngine.verify(password, hashedPassword);
    }

    // Fallback: Legacy Scrypt format (salt:hash)
    if (hashedPassword.includes(":")) {
      const [salt, originalHash] = hashedPassword.split(":");
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
    }

    return false;
  }

  /* ================= SECURE RANDOM TOKEN GENERATORS ================= */

  /**
   * Generates a cryptographically secure random hex string token
   */
  static randomToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Generates a cryptographically secure random integer between min and max (inclusive)
   */
  static randomInt(min = 100000, max = 999999) {
    return crypto.randomInt(min, max + 1);
  }

  /**
   * Generates a cryptographically secure random UUID
   */
  static uuid() {
    return crypto.randomUUID();
  }

  /* ================= AES-256-GCM STRING ENCRYPTION ================= */

  /**
   * Encrypts plain text using AES-256-GCM with a secret key
   */
  static encrypt(text, secretKey = null) {
    if (!text) throw new Error("Text is required for encryption");
    const keyToUse = secretKey || Config.get("AES_SECRET") || Config.get("APP_KEY");
    if (!keyToUse) throw new Error("Encryption key not configured. Set AES_SECRET or APP_KEY in .Vexora/config");

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(keyToUse, salt, 32);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts encrypted text using AES-256-GCM and a secret key
   */
  static decrypt(encryptedText, secretKey = null) {
    if (!encryptedText) return null;
    if (!encryptedText.includes(":")) return null;

    const keyToUse = secretKey || Config.get("AES_SECRET") || Config.get("APP_KEY");
    if (!keyToUse) throw new Error("Decryption key not configured. Set AES_SECRET or APP_KEY in .Vexora/config");

    try {
      const parts = encryptedText.split(":");
      let salt, ivHex, authTagHex, encryptedData;

      if (parts.length === 4) {
        [salt, ivHex, authTagHex, encryptedData] = parts;
        salt = Buffer.from(salt, "hex");
      } else if (parts.length === 3) {
        // Backward compatibility for old static salt
        [ivHex, authTagHex, encryptedData] = parts;
        salt = "VexoraSaltVal";
      } else {
        return null;
      }

      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const key = crypto.scryptSync(keyToUse, salt, 32);

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch {
      return null; // Invalid decryption key or tampered payload
    }
  }

  /**
   * Retrieves the client IP address, validating and respecting TRUST_PROXY settings
   */
  static getClientIp(req) {
    if (!req) return "0.0.0.0";
    if (req._ip) return req._ip;

    const trustProxy = Config.boolean("TRUST_PROXY", false);
    let ip = null;

    if (trustProxy) {
      const cfIp = req.headers["cf-connecting-ip"];
      if (cfIp) {
        ip = cfIp.trim();
      } else {
        const xForwarded = req.headers["x-forwarded-for"];
        if (xForwarded) {
          ip = xForwarded.split(",")[0].trim();
        }
      }
    }

    if (!ip) {
      ip = req.socket?.remoteAddress || "0.0.0.0";
    }

    // Normalise IPv6 mapped IPv4 addresses (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // Validate IP formatting to prevent header injection attacks
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      req._ip = "0.0.0.0";
      return "0.0.0.0"; // Fallback to safe invalid placeholder
    }

    req._ip = ip;
    return ip;
  }

  /**
   * Generates a cryptographically secure CSRF token and saves it in the request session
   */
  static generateCsrfToken(req) {
    if (!req || !req.session) {
      throw new Error("CSRF generation failed: Request session not initialized");
    }
    const token = crypto.randomBytes(32).toString("hex");
    req.session._csrf = token;
    return token;
  }

  /**
   * Verifies if the request contains a valid CSRF token matching the session
   */
  static verifyCsrfToken(req, paramName = "_token", headerName = "x-csrf-token") {
    if (!req || !req.session || !req.session._csrf) {
      return false;
    }
    const token = req.input(paramName) || req.headers[String(headerName).toLowerCase()];
    if (!token || typeof token !== "string") return false;

    const sessionToken = req.session._csrf;
    if (token.length !== sessionToken.length) return false;

    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken));
  }
}

export default Helper;
