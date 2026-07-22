"use strict";

/**
 * ==========================================================
 * Zentrox Framework
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

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

class Config {
  static config = {};
  static cache = {};

  static file = path.join(process.cwd(), ".vexora_config", "config");

  /**
   * Sync performance-critical configs as static properties
   */
  static sync() {
    this.ENABLE_SECURITY_HEADERS = this.boolean("ENABLE_SECURITY_HEADERS", true);
    this.SERVER_CLUSTER = this.boolean("SERVER_CLUSTER", false);
    this.ENABLE_REQUEST_CONTEXT = this.boolean("ENABLE_REQUEST_CONTEXT", true);
    this.RATE_LIMIT_REQUESTS = this.number("RATE_LIMIT_REQUESTS", 100);
    this.RATE_LIMIT_WINDOW = this.number("RATE_LIMIT_WINDOW", 60);
    this.RATE_LIMIT_ENABLED = this.get("RATE_LIMIT_ENABLED") !== "false" && this.RATE_LIMIT_REQUESTS !== -1;
    this.SESSION_LIFETIME = this.number("SESSION_LIFETIME", 3600);
    this.CLUSTER_WORKERS = this.number("CLUSTER_WORKERS", 0) || os.cpus().length;
    this.SHOW_EXECUTION_TIME = this.boolean("SHOW_EXECUTION_TIME", false);
  }

  /**
   * Load configuration
   */
  static load() {
    this.cache = {};
    if (!fs.existsSync(this.file)) {
      console.warn("⚠️ Warning: .vexora_config/config file not found. Relying on environment variables (process.env) if available.");
      this.config = {};
      this.sync();
      return;
    }

    try {
      const content = fs.readFileSync(this.file, "utf8");

      this.config = {};

      content.split(/\r?\n/).forEach((line) => {
        line = line.trim();

        if (!line || line.startsWith("#")) {
          return;
        }

        const index = line.indexOf("=");

        if (index === -1) {
          return;
        }

        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();

        this.config[key] = value;
      });
    } catch (err) {
      console.warn(`⚠️ Warning: Failed to read .vexora_config/config: ${err.message}. Relying on process.env.`);
      this.config = {};
    }
    this.sync();
  }

  /**
   * Reload config
   */
  static reload() {
    this.cache = {};
    this.load();

    return this.config;
  }

  /**
   * Get config value
   */
  static get(key, defaultValue = null) {
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }
    let val;
    if (process.env[key] !== undefined) {
      val = process.env[key];
    } else {
      val = this.has(key) ? this.config[key] : defaultValue;
    }
    this.cache[key] = val;
    return val;
  }

  /**
   * Set config value
   */
  static set(key, value) {
    this.config[key] = value;
    delete this.cache[key];
    delete this.cache[`bool_${key}`];
    delete this.cache[`num_${key}`];
    this.sync();

    return this;
  }

  /**
   * Check config exists
   */
  static has(key) {
    return process.env[key] !== undefined || Object.prototype.hasOwnProperty.call(this.config, key);
  }

  /**
   * Delete config
   */
  static remove(key) {
    delete this.config[key];
    delete this.cache[key];
    delete this.cache[`bool_${key}`];
    delete this.cache[`num_${key}`];
    this.sync();

    return this;
  }

  /**
   * Get all config
   */
  static all() {
    return { ...this.config };
  }

  /**
   * Boolean value
   */
  static boolean(key, defaultValue = false) {
    const cacheKey = `bool_${key}`;
    if (this.cache[cacheKey] !== undefined) {
      return this.cache[cacheKey];
    }
    const value = this.get(key);
    const val = value === null ? defaultValue : ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
    this.cache[cacheKey] = val;
    return val;
  }

  /**
   * Number value
   */
  static number(key, defaultValue = 0) {
    const cacheKey = `num_${key}`;
    if (this.cache[cacheKey] !== undefined) {
      return this.cache[cacheKey];
    }
    const value = this.get(key);
    const val = Number.isNaN(Number(value)) ? defaultValue : Number(value);
    this.cache[cacheKey] = val;
    return val;
  }
}

export default Config;
