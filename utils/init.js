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
        "# Database Configuration",
        "MYSQL_DB_URL=mysql://u978749416_eformx_it:3+Lkd@P9@82.25.121.48:3306/u978749416_eformx_it",
        "",
        "# Redis Configuration",
        "REDIS_DATABASE_SIZE=500MB",
        "",
        "# Server",
        "PORT=3000",
        "HOST=127.0.0.1",
        "BLOCKED_IPS=",
        "SUSPICIOUS_WINDOW=60",
        "SUSPICIOUS_THRESHOLD=30",
        "AUTO_BLOCK_DURATION=300",
        "DETECT_BOT_BEHAVIOR=true",
        "BOT_MIN_JITTER=15",
        "MAX_CONSECUTIVE_404S=15",
        "",
        "# Google reCAPTCHA / Cloudflare Turnstile Settings",
        "CAPTCHA_PROVIDER=google",
        "RECAPTCHA_SECRET=",
        "",
        "# Queue & Background Workers Settings (Options: 'memory' or 'cache')",
        "QUEUE_DRIVER=memory",
        "QUEUE_AUTO_START=true",
        "QUEUE_CONCURRENCY=2",
        "QUEUE_POLL_INTERVAL=1000",
        "",
        "# Task Scheduler Settings",
        "CRON_AUTO_START=true",
        "",
        "# Security Key (Used for Vexora.Helper encryption)",
        "AES_SECRET=MySecretMasterEncryptionKey",
        "",
        "# Session Lifetime (Milliseconds)",
        "SESSION_LIFETIME=300000",
        "",
        "# Global Rate Limiting / DDoS Protection",
        "RATE_LIMIT_REQUESTS=-1",
        "RATE_LIMIT_WINDOW=60",
        "ENABLE_SECURITY_HEADERS=false",
        "SERVER_CLUSTER=true",
        "SHOW_EXECUTION_TIME=false",
        "ENABLE_REQUEST_CONTEXT=false",
        "CLUSTER_WORKERS=6",
        "",
        "# SMTP Mail Configuration",
        "SMTP_HOST=smtp.hostinger.com",
        "SMTP_PORT=465",
        "SMTP_SECURE=ssl",
        "SMTP_USER=no_reply@eformx.in",
        "SMTP_PASS=f*8OLi=E",
        "FROM_NAME=eFormX",
        "FROM_EMAIL=no_reply@eformx.in",
        "",
        "# File Upload & Encrypted Storage Settings",
        "UPLOAD_MAX_SIZE_MB=5",
        "UPLOAD_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/jpg,application/pdf",
        "UPLOAD_STORAGE_ROOT=storage",
        "UPLOAD_ALLOWED_ROOTS=public,MyDrive,User,temporary",
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
