/**
 * ==========================================================
 * Vexora Encryption Engine — Main Module Entry Point
 * ==========================================================
 *
 * @author      Satyam Kumar
 * @email       satyam.ku9725@gmail.com
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 * ==========================================================
 */

import os from "node:os";
import PolymorphicCipher from "./PolymorphicCipher.js";
import BcryptEngine from "../security/Bcrypt.js";

export const VexoraEncryption = {
  /**
   * Encrypt data using installation-unique Polymorphic Engine
   */
  encrypt: (data, customPassword = "") => PolymorphicCipher.encrypt(data, customPassword),

  /**
   * Decrypt data using installation-unique Polymorphic Engine
   */
  decrypt: (cipherText, customPassword = "") => PolymorphicCipher.decrypt(cipherText, customPassword),

  /**
   * Get metadata info of installation's unique cipher matrix
   */
  getMatrixInfo: () => PolymorphicCipher.getMatrixInfo(),

  /**
   * Set dynamic custom secret key
   */
  setCustomKey: (newKey) => PolymorphicCipher.setCustomKey(newKey),

  /**
   * Generate PHP-compatible $2y$ Bcrypt password hash
   */
  password_hash: (password, cost = 10) => BcryptEngine.hash(password, cost, "$2y$"),

  /**
   * Verify password against PHP-compatible $2y$ / $2b$ Bcrypt hash
   */
  password_verify: (password, hash) => BcryptEngine.verify(password, hash),

  /**
   * Get server's local network IP address
   */
  getServerIp: () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
    return "127.0.0.1";
  },

  /**
   * Get client IP address from HTTP request
   */
  getClientIp: (req) => {
    if (!req) return "0.0.0.0";
    return req.headers?.["cf-connecting-ip"] || req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "127.0.0.1";
  }
};

export default VexoraEncryption;
