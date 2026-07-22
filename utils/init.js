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

      const vexoraApiDir = path.join(rootDir, ".Vexora_Api");
      // Create .Vexora_Api directory if it does not exist
      if (!fs.existsSync(vexoraApiDir)) {
        fs.mkdirSync(vexoraApiDir, {
          recursive: true,
        });
      }

      const vexoraErrorDir = path.join(rootDir, ".Vexora_error");
      // Create .Vexora_error directory if it does not exist
      if (!fs.existsSync(vexoraErrorDir)) {
        fs.mkdirSync(vexoraErrorDir, {
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

      // Create config file
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, config, {
          encoding: "utf8",
          mode: 0o600,
        });

        console.log("✅ .Vexora/config created");
      }

      // Create db_config.json file
      const dbConfigPath = path.join(vexoraDir, "db_config.json");
      const defaultDbConfig = {
        "auth": {
          "DB_HOST": "127.0.0.1",
          "DB_NAME": "u978749416_eformx_it",
          "DB_USER": "root",
          "DB_PASS": "",
          "MSG": "auth",
          "DB_DRIVER": "mysql",
          "driver": "mysql"
        }
      };

      if (!fs.existsSync(dbConfigPath)) {
        fs.writeFileSync(dbConfigPath, JSON.stringify(defaultDbConfig, null, 2), {
          encoding: "utf8",
          mode: 0o600,
        });

        console.log("✅ .Vexora/db_config.json created");
      }

      // Create .htaccess for LiteSpeed / Apache WebSocket Support
      const htaccessPath = path.join(rootDir, ".htaccess");
      if (!fs.existsSync(htaccessPath)) {
        const htaccessContent = [
          "# ==========================================================",
          "# Vexora Framework - Auto Generated Server Config",
          "# ==========================================================",
          "<IfModule mod_rewrite.c>",
          "    RewriteEngine On",
          "    ",
          "    # Enable WebSockets proxy for LiteSpeed / Apache servers",
          "    # Note: If your Vexora app runs on a port other than 3000, ",
          "    # update the port number below!",
          "    RewriteCond %{HTTP:Upgrade} =websocket [NC]",
          "    RewriteRule /(.*)           ws://127.0.0.1:3000/$1 [P,L]",
          "</IfModule>",
          ""
        ].join("\n");
        
        fs.writeFileSync(htaccessPath, htaccessContent, {
          encoding: "utf8",
          mode: 0o644,
        });
        
        console.log("✅ .htaccess created for WebSocket Proxy Support");
      }

      // Create Nginx Example Config for WebSockets
      const nginxConfigPath = path.join(rootDir, "nginx-websocket.conf.example");
      if (!fs.existsSync(nginxConfigPath)) {
        const nginxContent = [
          "# ==========================================================",
          "# Vexora Framework - Nginx WebSocket Configuration Example",
          "# ==========================================================",
          "# If you are using Nginx instead of Apache/LiteSpeed, Nginx",
          "# will ignore the .htaccess file. You must add these lines",
          "# to your Nginx Server Block (e.g., in /etc/nginx/sites-available/).",
          "",
          "location / {",
          "    proxy_pass http://127.0.0.1:3000;",
          "    proxy_http_version 1.1;",
          "    proxy_set_header Upgrade $http_upgrade;",
          "    proxy_set_header Connection \"Upgrade\";",
          "    proxy_set_header Host $host;",
          "    proxy_cache_bypass $http_upgrade;",
          "}",
          ""
        ].join("\n");
        
        fs.writeFileSync(nginxConfigPath, nginxContent, {
          encoding: "utf8",
          mode: 0o644,
        });
        
        console.log("✅ nginx-websocket.conf.example created");
      }
    } catch (err) {
      console.warn("⚠️ Warning: Failed to run framework Init.setup() (filesystem might be read-only):", err.message);
    }
  }
}

export default Init;
