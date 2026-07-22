/**
 * Vexora Framework - Maintenance Commands
 */

import fs from "node:fs";
import path from "node:path";
import { vexoraConfigDir, logsDir, line } from "./helpers.js";

export const maintenanceCommands = {
  "log:clear": {
    description: "Clears all Vexora audit log files",
    category: "🧹 Maintenance",
    async run() {
      const logDir = logsDir();
      if (!fs.existsSync(logDir)) {
        console.log("  (No log directory found)");
        return;
      }
      const files = fs.readdirSync(logDir);
      let cleared = 0;
      for (const file of files) {
        const filePath = path.join(logDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          cleared++;
        }
      }
      console.log(`✅ Cleared ${cleared} log file(s) from .vexora_log/`);
    },
  },

  "config:show": {
    description: "Displays current Vexora configuration settings",
    category: "🧹 Maintenance",
    async run() {
      const configPath = path.join(vexoraConfigDir(), "config");
      line();
      console.log("⚙️ VEXORA CONFIGURATION (.vexora_config/config)");
      line();
      if (!fs.existsSync(configPath)) {
        console.log("  (Config file not found)");
      } else {
        const content = fs.readFileSync(configPath, "utf8");
        const lines = content.split("\n");
        for (const l of lines) {
          const trimmed = l.trim();
          if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("="))
            continue;
          console.log(`  ${trimmed}`);
        }
      }
      line();
    },
  },

  "reset:config": {
    description: "Resets Vexora configuration to default settings",
    category: "🧹 Maintenance",
    aliases: ["config:reset"],
    async run() {
      const configPath = path.join(vexoraConfigDir(), "config");

      const defaultConfig = [
        "# ==========================================================",
        "# Vexora Framework Configuration (Reset to Defaults)",
        "# ==========================================================",
        "",
        "# ----------------------------------------------------------",
        "# RAM Cache",
        "# ----------------------------------------------------------",
        "REDIS_DATABASE_SIZE=500MB",
        "",
        "# ----------------------------------------------------------",
        "# Web Server",
        "# ----------------------------------------------------------",
        "PORT=3000",
        "HOST=127.0.0.1",
        "BLOCKED_IPS=",
        "EMERGENCY_BLOCK=false",
        "",
        "# ----------------------------------------------------------",
        "# DDoS / Bot Shield Guard",
        "# ----------------------------------------------------------",
        "SUSPICIOUS_WINDOW=60",
        "SUSPICIOUS_THRESHOLD=30",
        "AUTO_BLOCK_DURATION=300",
        "DETECT_BOT_BEHAVIOR=true",
        "BOT_MIN_JITTER=15",
        "MAX_CONSECUTIVE_404S=15",
        "",
        "# ----------------------------------------------------------",
        "# CAPTCHA Settings",
        "# ----------------------------------------------------------",
        "CAPTCHA_PROVIDER=google",
        "RECAPTCHA_SECRET=",
        "",
        "# ----------------------------------------------------------",
        "# Job Queue",
        "# ----------------------------------------------------------",
        "QUEUE_DRIVER=memory",
        "QUEUE_AUTO_START=true",
        "QUEUE_CONCURRENCY=2",
        "QUEUE_POLL_INTERVAL=1000",
        "",
        "# ----------------------------------------------------------",
        "# Cron Task Scheduler",
        "# ----------------------------------------------------------",
        "CRON_AUTO_START=true",
        "",
        "# ----------------------------------------------------------",
        "# Security & Session",
        "# ----------------------------------------------------------",
        "AES_SECRET=",
        "SESSION_LIFETIME=300000",
        "RATE_LIMIT_REQUESTS=-1",
        "RATE_LIMIT_WINDOW=60",
        "ENABLE_SECURITY_HEADERS=true",
        "SERVER_CLUSTER=false",
        "SHOW_EXECUTION_TIME=true",
        "ENABLE_REQUEST_CONTEXT=true",
        "CLUSTER_WORKERS=6",
        "",
        "# ----------------------------------------------------------",
        "# SMTP Email Outbound",
        "# ----------------------------------------------------------",
        "SMTP_HOST=smtp.example.com",
        "SMTP_PORT=465",
        "SMTP_SECURE=ssl",
        "SMTP_USER=user@example.com",
        "SMTP_PASS=password123",
        "FROM_NAME=VexoraMailer",
        "FROM_EMAIL=user@example.com",
        "",
        "# ----------------------------------------------------------",
        "# File Storage & Upload",
        "# ----------------------------------------------------------",
        "UPLOAD_MAX_SIZE_MB=5",
        "UPLOAD_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/jpg,application/pdf",
        "UPLOAD_STORAGE_ROOT=files",
        "UPLOAD_ALLOWED_ROOTS=files,storage,public,MyDrive,User,temporary",
      ].join("\n");

      fs.writeFileSync(configPath, defaultConfig, "utf8");
      console.log("✅ Configuration reset to default settings successfully!");
      console.log("📁 File: .vexora_config/config");
    },
  }
};
