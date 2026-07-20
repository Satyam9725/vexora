/**
 * ==========================================================
 * Vexora Framework - Initializer
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

class Init {
  static setup() {
    try {
      const rootDir = process.cwd();
      const vexoraDir = path.join(rootDir, ".Vexora");

      // Create .Vexora directory if it does not exist
      if (!fs.existsSync(vexoraDir)) {
        fs.mkdirSync(vexoraDir, {
          recursive: true,
        });
      }

      const configPath = path.join(vexoraDir, "config");

      // Essential configurations only
      const config = [
        "# ==========================================================",
        "# Vexora Framework Configuration",
        "# ==========================================================",
        "",
        "# ----------------------------------------------------------",
        "# Database Configuration",
        "# ----------------------------------------------------------",
        "# Primary MySQL database connection URL string",
        "MYSQL_DB_URL=mysql://u978749416_eformx_it:3+Lkd@P9@82.25.121.48:3306/u978749416_eformx_it",
        "",
        "# ----------------------------------------------------------",
        "# RAM Cache Configuration",
        "# ----------------------------------------------------------",
        "# Maximum memory size allocation for the Redis-mock in-memory cache",
        "REDIS_DATABASE_SIZE=500MB",
        "",
        "# ----------------------------------------------------------",
        "# Web Server Configuration",
        "# ----------------------------------------------------------",
        "# Network port where the HTTP server will listen",
        "PORT=3000",
        "",
        "# Host IP address to bind (127.0.0.1 for local access, 0.0.0.0 for public access)",
        "HOST=127.0.0.1",
        "",
        "# Comma-separated list of IP addresses to permanently block (403 Forbidden)",
        "BLOCKED_IPS=",
        "",
        "# ----------------------------------------------------------",
        "# DDoS / Bot Shield Guard Configuration",
        "# ----------------------------------------------------------",
        "# Time window (in seconds) to count requests per IP",
        "SUSPICIOUS_WINDOW=60",
        "",
        "# Max request count within the window before blocking the IP temporarily",
        "SUSPICIOUS_THRESHOLD=30",
        "",
        "# Duration (in seconds) for which a suspicious IP will remain blocked",
        "AUTO_BLOCK_DURATION=300",
        "",
        "# Enable (true) or disable (false) advanced Bot Detection",
        "DETECT_BOT_BEHAVIOR=true",
        "",
        "# Minimum variance (in ms) between request intervals to filter out loop-interval bots",
        "BOT_MIN_JITTER=15",
        "",
        "# Max consecutive 404 Route Not Found errors from an IP before auto-blocking it",
        "MAX_CONSECUTIVE_404S=15",
        "",
        "# ----------------------------------------------------------",
        "# Google reCAPTCHA / Cloudflare Turnstile Settings",
        "# ----------------------------------------------------------",
        "# Captcha provider choice ('google' for reCAPTCHA or 'cloudflare' for Turnstile)",
        "CAPTCHA_PROVIDER=google",
        "",
        "# Captcha provider secret API key for server-side verification",
        "RECAPTCHA_SECRET=",
        "",
        "# ----------------------------------------------------------",
        "# Job Queue Settings",
        "# ----------------------------------------------------------",
        "# Storage driver option for holding background jobs ('memory' or 'cache')",
        "QUEUE_DRIVER=memory",
        "",
        "# Auto-start the background queue worker process on server startup (true/false)",
        "QUEUE_AUTO_START=true",
        "",
        "# Number of concurrent jobs to process at a single time",
        "QUEUE_CONCURRENCY=2",
        "",
        "# Interval (in milliseconds) to poll and check for new jobs in the queue",
        "QUEUE_POLL_INTERVAL=1000",
        "",
        "# ----------------------------------------------------------",
        "# Cron Task Scheduler Settings",
        "# ----------------------------------------------------------",
        "# Auto-start the cron schedule manager on server startup (true/false)",
        "CRON_AUTO_START=true",
        "",
        "# ----------------------------------------------------------",
        "# Security & Session Settings",
        "# ----------------------------------------------------------",
        "# Secret key used for cryptographic functions (like Vexora.Helper encrypt/decrypt)",
        "AES_SECRET=MySecretMasterEncryptionKey",
        "",
        "# Lifetime of user sessions in milliseconds (300000ms = 5 minutes)",
        "SESSION_LIFETIME=300000",
        "",
        "# ----------------------------------------------------------",
        "# Global Rate Limiting / DDoS Protection",
        "# ----------------------------------------------------------",
        "# Global max requests allowed per IP address within rate limit window (-1 to disable)",
        "RATE_LIMIT_REQUESTS=-1",
        "",
        "# Window size (in seconds) for checking global rate limits",
        "RATE_LIMIT_WINDOW=60",
        "",
        "# Inject standard Helmet-style security response headers (true/false)",
        "ENABLE_SECURITY_HEADERS=true",
        "",
        "# Enable multi-core processor cluster mode to load-balance over multiple processes (true/false)",
        "SERVER_CLUSTER=false",
        "",
        "# Automatically calculate and append API execution latency time to JSON responses (true/false)",
        "SHOW_EXECUTION_TIME=true",
        "",
        "# Enable thread-safe async storage context mapping for request/response (true/false)",
        "ENABLE_REQUEST_CONTEXT=true",
        "",
        "# Number of cluster worker processes to spawn (ignored if SERVER_CLUSTER is false)",
        "CLUSTER_WORKERS=6",
        "",
        "# ----------------------------------------------------------",
        "# SMTP Email Outbound Configuration",
        "# ----------------------------------------------------------",
        "# Outgoing SMTP mail server host",
        "SMTP_HOST=smtp.hostinger.com",
        "",
        "# Outgoing SMTP mail server port (usually 465 for SSL/TLS, 587 for STARTTLS)",
        "SMTP_PORT=465",
        "",
        "# SMTP transport security type ('ssl', 'tls', or 'none')",
        "SMTP_SECURE=ssl",
        "",
        "# SMTP outbound server authentication username",
        "SMTP_USER=no_reply@eformx.in",
        "",
        "# SMTP outbound server authentication password",
        "SMTP_PASS=f*8OLi=E",
        "",
        "# Sender display name shown on outgoing emails",
        "FROM_NAME=eFormX",
        "",
        "# Default sender email address for outgoing mail",
        "FROM_EMAIL=no_reply@eformx.in",
        "",
        "# ----------------------------------------------------------",
        "# File Storage & Upload Settings",
        "# ----------------------------------------------------------",
        "# Maximum permitted file size in Megabytes for uploads",
        "UPLOAD_MAX_SIZE_MB=5",
        "",
        "# Comma-separated list of allowed file extension MIME types",
        "UPLOAD_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/jpg,application/pdf",
        "",
        "# Directory where uploaded files are saved physically on disk",
        "UPLOAD_STORAGE_ROOT=files",
        "",
        "# Whitelisted directory prefixes allowed for directory operations (blocks path traversal)",
        "UPLOAD_ALLOWED_ROOTS=files,storage,public,MyDrive,User,temporary",
      ].join("\n");

      // Create config file
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, config, {
          encoding: "utf8",
          mode: 0o600,
        });

        console.log("✅ .Vexora/config created");
      }
    } catch (err) {
      console.warn("⚠️ Warning: Failed to run framework Init.setup() (filesystem might be read-only):", err.message);
    }
  }
}

export default Init;
