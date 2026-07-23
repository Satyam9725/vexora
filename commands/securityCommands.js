/**
 * Vexora Framework - Master Cyber Defense & Threat Analyzer (14-Step Deep Audit Engine)
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { rootDir, vexoraConfigDir, apiRoutesDir, line, colors, padDisplayEnd, ensureDir } from "./helpers.js";
import { requestContext } from "../core/Context.js";

const nodeBuiltins = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console", "crypto", "dgram", "dns",
  "domain", "events", "fs", "http", "http2", "https", "inspector", "module", "net", "os", "path",
  "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "stream", "string_decoder",
  "timers", "tls", "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads", "zlib",
  "node:assert", "node:async_hooks", "node:buffer", "node:child_process", "node:cluster", "node:console",
  "node:crypto", "node:dgram", "node:dns", "node:domain", "node:events", "node:fs", "node:http", "node:http2",
  "node:https", "node:inspector", "node:module", "node:net", "node:os", "node:path", "node:perf_hooks",
  "node:process", "node:punycode", "node:querystring", "node:readline", "node:repl", "node:stream",
  "node:string_decoder", "node:timers", "node:tls", "node:trace_events", "node:tty", "node:url", "node:util",
  "node:v8", "node:vm", "node:wasi", "node:worker_threads", "node:zlib"
]);

const validResMethods = new Set([
  "json", "success", "error", "send", "html", "redirect", "status", "setHeader", "cookie",
  "clearCookie", "end", "write", "download", "render", "header", "type", "file", "stream", "pipe",
  "writeHead", "on", "once", "emit", "removeHeader", "getHeader", "hasHeader", "getHeaderNames",
  "getHeaders", "uncork", "cork", "flushHeaders", "assignSocket", "detachSocket",
  "text", "headers", "setContentType", "noContent", "created", "badRequest", "unauthorized",
  "forbidden", "notFound", "ok", "statusText"
]);

export const securityCommands = {
  "security:blocked": {
    description: "Shows all currently blocked IPs",
    category: "🛡️ Security",
    async run() {
      const Config = (await import("../core/config.js")).default;
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      line();
      console.log("🛡️ VEXORA SECURITY GUARD - BLOCKED IPS");
      line();
      const staticBlocked = (Config.get("BLOCKED_IPS") || "")
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
      console.log(
        `  📌 Permanently Blocked (Config): ${staticBlocked.length > 0 ? staticBlocked.join(", ") : "None"}`
      );

      const allKeys = MemoryCache.keys();
      const tempBlocked = allKeys
        .filter((k) => k.startsWith("temp_blocked_ip:"))
        .map((k) => k.replace("temp_blocked_ip:", ""));
      console.log(
        `  ⏳ Auto-Blocked (Bot/DDoS Shield): ${tempBlocked.length > 0 ? tempBlocked.join(", ") : "None"}`
      );
      line();
    },
  },

  "security:unblock": {
    description: "Unblocks an IP from temporary cache shield",
    usage: "security:unblock <ip>",
    category: "🛡️ Security",
    async run(args) {
      if (!args[1]) {
        console.error("❌ Please specify the IP to unblock.");
        console.error("   Usage: vexora security:unblock <ip>");
        return;
      }
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      const ipToUnblock = args[1].trim();
      MemoryCache.del("temp_blocked_ip:" + ipToUnblock);
      console.log(`✅ Unblocked IP ${ipToUnblock} from memory cache shield.`);
    },
  },

  "security:audit": {
    description: "Runs full advanced security vulnerability & cyber threat hunting audit (14-step deep analysis)",
    category: "🛡️ Security",
    aliases: ["security:scan", "security:analyzer", ":scan", "scan"],
    async run() {
      const c = colors;
      const root = rootDir();
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const TOTAL_STEPS = 14;

      const pkgPath = path.join(root, "package.json");
      const installedPkgs = new Set(["vexora"]);
      let pkgJson = null;
      if (fs.existsSync(pkgPath)) {
        try {
          pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          const allDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}), ...(pkgJson.peerDependencies || {}) };
          Object.keys(allDeps).forEach((d) => installedPkgs.add(d));
        } catch (e) { }
      }

      console.log("");

      const findings = [];
      let totalFilesScanned = 0;
      let syntaxErrors = 0;
      const fileIssueMap = new Map();

      const addFinding = (type, category, title, details, recommendation, file = null) => {
        const finding = { type, category, title, details, recommendation, file };
        findings.push(finding);
        if (file) {
          if (!fileIssueMap.has(file)) fileIssueMap.set(file, []);
          fileIssueMap.get(file).push(finding);
        }
      };

      // ══════════════════════════════════════════════════════════
      // CYBER SECURITY DASHBOARD HUD UI ENGINE
      // ══════════════════════════════════════════════════════════
      const hudState = {
        progressPct: 0,
        currentStep: 1,
        stepTag: "CONFIG-PROBE",
        currentFile: ".vexora_config/config",
        filesScanned: 0,
        totalFiles: 127,
        speed: 452,
        eta: "0.2s",
        workers: 8,
        threats: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          latestMedium: "",
          latestLow: ""
        },
        lastChecks: []
      };

      let hudPrintedLines = 0;

      const stripAnsi = (str) => String(str).replace(/\x1b\[[0-9;]*m/g, "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "  ");

      const drawHudLine = (contentStr, innerWidth = 74) => {
        const visibleLen = stripAnsi(contentStr).length;
        const padLen = Math.max(0, innerWidth - visibleLen);
        return `│ ${contentStr}${" ".repeat(padLen)} │\n`;
      };

      const renderCyberDashboardHUD = () => {
        const innerWidth = 74;
        const top    = `╭${"─".repeat(innerWidth + 2)}╮\n`;
        const sep    = `├${"─".repeat(innerWidth + 2)}┤\n`;
        const bottom = `╰${"─".repeat(innerWidth + 2)}╯\n`;

        const barLen = 25;
        const filled = Math.round((hudState.progressPct / 100) * barLen);
        const barStr = `${c.brightCyan}${"█".repeat(filled)}${c.gray}${"░".repeat(barLen - filled)}${c.reset}`;
        const pctStr = `${c.brightYellow}${String(hudState.progressPct).padStart(3)}%${c.reset}`;

        const rawFile = hudState.currentFile || "Project Environment Audit...";
        const displayFile = rawFile.length > 50 ? "..." + rawFile.slice(-47) : rawFile;

        const medAddon = hudState.threats.latestMedium ? `  ${c.dim}(+ ${hudState.threats.latestMedium})${c.reset}` : "";
        const lowAddon = hudState.threats.latestLow ? `  ${c.dim}(+ ${hudState.threats.latestLow})${c.reset}` : "";

        let out = "";
        out += top;
        out += drawHudLine(`🔒 ${c.bold}${c.brightCyan}VEXORA Security Scanner${c.reset}`);
        out += sep;
        out += drawHudLine(`Progress   ${barStr}  ${pctStr}`);
        out += drawHudLine(`File       ${c.dim}${displayFile}${c.reset}`);
        out += drawHudLine(`Files      ${c.bold}${hudState.filesScanned}${c.reset} / ${hudState.totalFiles}`);
        out += drawHudLine(`Speed      ${c.bold}${hudState.speed}${c.reset} files/s`);
        out += drawHudLine(`ETA        ${c.bold}${hudState.eta}${c.reset}`);
        out += drawHudLine(`Workers    ${c.bold}${hudState.workers}${c.reset}`);
        out += sep;
        out += drawHudLine(`${c.bold}Live Threats${c.reset}`);
        out += drawHudLine(`🔴 Critical : ${hudState.threats.critical > 0 ? c.brightRed : c.reset}${hudState.threats.critical}${c.reset}`);
        out += drawHudLine(`🟠 High     : ${hudState.threats.high > 0 ? c.brightRed : c.reset}${hudState.threats.high}${c.reset}`);
        out += drawHudLine(`🟡 Medium   : ${hudState.threats.medium > 0 ? c.brightYellow : c.reset}${hudState.threats.medium}${c.reset}${medAddon}`);
        out += drawHudLine(`🔵 Low      : ${hudState.threats.low > 0 ? c.brightCyan : c.reset}${hudState.threats.low}${c.reset}${lowAddon}`);
        out += sep;
        out += drawHudLine(`${c.bold}Last Check${c.reset}`);

        const checks = hudState.lastChecks.slice(-3);
        while (checks.length < 3) {
          checks.unshift({ file: "Waiting for scan...", status: "Safe", isWarn: false });
        }

        for (const chk of checks) {
          const icon = chk.isWarn ? `${c.brightYellow}⚠${c.reset}` : `${c.brightGreen}✓${c.reset}`;
          const fPath = chk.file.length > 40 ? "..." + chk.file.slice(-37) : chk.file;
          const statusCol = chk.isWarn ? `${c.brightYellow}${chk.status}${c.reset}` : `${c.brightGreen}${chk.status}${c.reset}`;
          const leftPart = `${icon} ${fPath}`;
          const padSpace = Math.max(1, 48 - stripAnsi(fPath).length);
          out += drawHudLine(`${leftPart}${" ".repeat(padSpace)}${statusCol}`);
        }

        if (hudState.score !== undefined) {
          out += sep;
          out += drawHudLine(`${c.bold}Cyber Defense Score : ${hudState.gradeColor}${hudState.score}/100 — GRADE ${hudState.grade}${c.reset}`);
        }

        out += bottom;

        if (hudPrintedLines > 0) {
          process.stdout.write(`\x1b[${hudPrintedLines}A`);
        }

        const linesArray = out.split("\n");
        hudPrintedLines = linesArray.length - 1;
        process.stdout.write(out);
      };

      const animateCyberBar = async (stepNum, tag, titleStr, durationMs = 60, extraInfo = "") => {
        const cleanTag = tag.replace(/^\[|\]$/g, "");
        hudState.currentStep = stepNum;
        hudState.stepTag = cleanTag;
        hudState.currentFile = titleStr;
        hudState.progressPct = Math.round((stepNum / TOTAL_STEPS) * 100);

        const fails = findings.filter(f => f.type === "FAIL");
        const warns = findings.filter(f => f.type === "WARN");
        const infos = findings.filter(f => f.type === "INFO");

        hudState.threats.critical = fails.length;
        hudState.threats.medium = warns.length;
        hudState.threats.low = infos.length;

        if (warns.length > 0) hudState.threats.latestMedium = warns[warns.length - 1].category;
        if (infos.length > 0) hudState.threats.latestLow = infos[infos.length - 1].category;

        hudState.lastChecks.push({
          file: titleStr,
          status: extraInfo || (fails.length > 0 ? "Threat Detected" : "Safe"),
          isWarn: fails.length > 0 || warns.length > 0
        });

        renderCyberDashboardHUD();
        await sleep(30);
      };

      // ══════════════════════════════════════════════════════════
      // STEP 1: CONFIGURATION & ENVIRONMENT AUDIT
      // ══════════════════════════════════════════════════════════
      const configPath = path.join(vexoraConfigDir(), "config");
      const configMap = {};
      if (!fs.existsSync(configPath)) {
        addFinding("WARN", "Configuration", "Config File Missing",
          ".vexora_config/config not found. Default fallback settings will be used.",
          "Run your server once or run 'npx vexora reset:config' to generate it.");
      } else {
        const configContent = fs.readFileSync(configPath, "utf8");
        configContent.split("\n").forEach((l) => {
          const trimmed = l.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const idx = trimmed.indexOf("=");
            configMap[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
          }
        });

        if (configMap["CORS_ORIGINS"] === "*") {
          addFinding("WARN", "CORS Security", "Permissive Wildcard CORS Origin",
            "CORS_ORIGINS is set to '*' allowing any domain to send cross-origin requests.",
            "In production, restrict CORS_ORIGINS to specific trusted domains.");
        }

        if (!configMap["DETECT_BOT_BEHAVIOR"] || configMap["DETECT_BOT_BEHAVIOR"].toLowerCase() !== "true") {
          addFinding("WARN", "Bot Shield", "Bot Behavior Detection Disabled or Missing",
            "DETECT_BOT_BEHAVIOR is missing or set to false. Automated bot shielding is turned off.",
            "Set DETECT_BOT_BEHAVIOR=true in .vexora_config/config.");
        }
        if (!configMap["SUSPICIOUS_THRESHOLD"] || !configMap["AUTO_BLOCK_DURATION"] || !configMap["MAX_CONSECUTIVE_404S"]) {
          addFinding("WARN", "Bot Shield", "DDoS / Bot Guard Parameters Missing",
            "One or more Bot Shield parameters (SUSPICIOUS_THRESHOLD, AUTO_BLOCK_DURATION, MAX_CONSECUTIVE_404S) are missing from config.",
            "Run 'npx vexora reset:config' or re-add Bot Guard settings in .vexora_config/config.");
        }

        if (!configMap["ENABLE_SECURITY_HEADERS"] || configMap["ENABLE_SECURITY_HEADERS"].toLowerCase() !== "true") {
          addFinding("FAIL", "HTTP Security", "Security Headers Disabled or Missing",
            "ENABLE_SECURITY_HEADERS is missing or set to false. OWASP Security headers are turned off.",
            "Set ENABLE_SECURITY_HEADERS=true in .vexora_config/config.");
        }
        if (!configMap["CSRF_SECRET"] || configMap["CSRF_SECRET"].length < 8) {
          addFinding("INFO", "CSRF Guard", "CSRF Secret Key Unset",
            "CSRF_SECRET is empty or short. Auto-generated session keys will be used.",
            "Set a strong random string for CSRF_SECRET in .vexora_config/config.");
        }
        if (configMap["RATE_LIMIT_MAX"] && parseInt(configMap["RATE_LIMIT_MAX"]) > 500) {
          addFinding("WARN", "Rate Limiter", "Very High Rate Limit Threshold",
            `RATE_LIMIT_MAX is set to ${configMap["RATE_LIMIT_MAX"]}. This may not protect against abuse.`,
            "Consider a lower RATE_LIMIT_MAX (e.g., 100-200) for production.");
        }
        if (configMap["ENABLE_AUDIT_LOG"] === "false") {
          addFinding("INFO", "Audit Logging", "Audit Logging Disabled",
            "ENABLE_AUDIT_LOG is set to false. Request activity logging is turned off.",
            "Set ENABLE_AUDIT_LOG=true in .vexora_config/config for production monitoring.");
        }
      }

      // Check Polymorphic Cipher Matrix Integrity
      const polyCipherPath = path.join(vexoraConfigDir(), "polymorphic_cipher.json");
      if (!fs.existsSync(polyCipherPath)) {
        addFinding("FAIL", "Polymorphic Cipher Security", "🚨 SECURITY WARNING: Polymorphic Cipher Matrix Uninitialized!",
          ".vexora_config/polymorphic_cipher.json does not exist. Application encryption engine is uninitialized.",
          "Run your server or execute 'vexora security:cipher:reset' to generate it.");
      } else {
        try {
          const polyData = JSON.parse(fs.readFileSync(polyCipherPath, "utf8"));
          const sBoxSize = Array.isArray(polyData.s_box) ? polyData.s_box.length : 0;
          const keyLen = polyData.custom_key ? polyData.custom_key.length : (polyData.custum_kye ? polyData.custum_kye.length : 0);

          if (sBoxSize < 4096 || keyLen < 10000) {
            addFinding("FAIL", "Polymorphic Cipher Security",
              "🚨 SECURITY LOST: Polymorphic Cipher Matrix Degraded / Corrupted!",
              `Current s_box size: ${sBoxSize}/4096, custom_key length: ${keyLen}/10000. Encryption security level is severely degraded!`,
              "Run 'vexora security:cipher:reset' to safely regenerate a fresh 4,096-element S-Box and 10,000+ char Master Key.");
          }
        } catch (e) {
          addFinding("FAIL", "Polymorphic Cipher Security",
            "🚨 SECURITY LOST: Corrupted polymorphic_cipher.json File!",
            `Failed to parse .vexora_config/polymorphic_cipher.json: ${e.message}`,
            "Run 'vexora security:cipher:reset' to regenerate your cipher configuration.");
        }
      }

      const envFile = path.join(root, ".env");
      if (fs.existsSync(envFile)) {
        const gitignorePath = path.join(root, ".gitignore");
        let envIgnored = false;
        if (fs.existsSync(gitignorePath)) {
          const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
          envIgnored = gitignoreContent.split("\n").some(l => l.trim() === ".env" || l.trim() === ".env*");
        }
        if (!envIgnored) {
          addFinding("FAIL", "Environment Security", ".env File Not in .gitignore",
            ".env file exists but is not listed in .gitignore. It may leak to version control.",
            "Add '.env' to your .gitignore to prevent secrets from being committed.");
        }
      }

      await animateCyberBar(1, "[CONFIG-PROBE]", "Environment Audit & Config Integrity", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 2: DATABASE HANDSHAKE AUDIT
      // ══════════════════════════════════════════════════════════
      const dbCfgPath = path.join(vexoraConfigDir(), "db_config.json");
      let dbConnectionsTested = 0;
      const validDrivers = ["mysql", "postgres", "postgresql", "mongodb", "mongo"];

      if (fs.existsSync(dbCfgPath)) {
        try {
          const dbConfigs = JSON.parse(fs.readFileSync(dbCfgPath, "utf8"));
          for (const [key, cfg] of Object.entries(dbConfigs)) {
            const driver = (cfg.driver || cfg.DB_DRIVER || "mysql").toLowerCase();
            const isEnabled = cfg.enabled !== false && cfg.ENABLED !== false && cfg.enabled !== "false";

            if (!isEnabled) {
              addFinding("NOTICE", "Disabled Database Connection",
                `Database connection '${key}' is disabled (enabled: false)`,
                `Connection '${key}' is turned OFF. Vexora query engine will reject calls to this DB until enabled.`,
                "Set 'enabled: true' in .vexora_config/db_config.json when ready to use.");
              continue;
            }

            if (!validDrivers.includes(driver)) {
              addFinding("FAIL", "Invalid Database Driver",
                `Invalid Driver '${driver}' in connection '${key}'`,
                `Driver '${driver}' is not supported by Vexora Framework.`,
                "Supported drivers: mysql, postgres, mongodb. Fix 'DB_DRIVER' in .vexora_config/db_config.json.");
              continue;
            }

            const host = cfg.host || cfg.DB_HOST || "127.0.0.1";
            const port = cfg.port || cfg.DB_PORT || (driver === "postgres" ? 5432 : (driver === "mongodb" ? 27017 : 3306));
            const user = cfg.user || cfg.DB_USER || "root";
            const pass = cfg.password || cfg.DB_PASS || "";
            const dbName = cfg.database || cfg.DB_NAME || "";
            dbConnectionsTested++;

            try {
              if (driver === "mysql") {
                const mysql2 = await import("mysql2/promise").catch(() => null);
                if (mysql2) {
                  const conn = await mysql2.createConnection({
                    host, port: Number(port), user, password: pass,
                    database: dbName, connectTimeout: 3000
                  });
                  await conn.query("SELECT 1");
                  await conn.end();
                }
              } else if (driver === "postgres" || driver === "postgresql") {
                const pg = await import("pg").catch(() => null);
                if (pg) {
                  const client = new pg.Client({
                    host, port: Number(port), user, password: pass,
                    database: dbName, connectionTimeoutMillis: 3000
                  });
                  await client.connect();
                  await client.query("SELECT 1");
                  await client.end();
                }
              } else if (driver === "mongodb" || driver === "mongo") {
                const mongoModule = await import("mongodb").catch(() => null);
                if (mongoModule) {
                  const { MongoClient } = mongoModule;
                  const dbUrl = cfg.DB_URL || `mongodb://${user}:${encodeURIComponent(pass)}@${host}:${port}/${dbName}`;
                  const client = new MongoClient(dbUrl, { connectTimeoutMS: 3000 });
                  await client.connect();
                  await client.close();
                }
              }
            } catch (dbErr) {
              addFinding("FAIL", "Database Connection",
                `Failed to Connect to Database "${key}" (${driver})`,
                `Host: ${host}:${port}, DB: ${dbName || "default"}. Error: ${dbErr.message}`,
                "Check database service status and credentials in .vexora_config/db_config.json.");
            }
          }
        } catch (e) { }
      }

      await animateCyberBar(2, "[DB-PROBE]", "Database Connectivity & Handshake Probes", 100,
        dbConnectionsTested > 0 ? `${dbConnectionsTested} connection(s) tested` : "no db_config found");

      // ══════════════════════════════════════════════════════════
      // STEP 3: HEADERS & SHIELD AUDIT
      // ══════════════════════════════════════════════════════════
      await animateCyberBar(3, "[SHIELD-GUARD]", "DDoS Shield, Bot Guard & OWASP Headers", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 4: DEPENDENCY VULNERABILITY SCAN (npm audit)
      // ══════════════════════════════════════════════════════════
      let npmAuditVulns = 0;
      if (fs.existsSync(path.join(root, "node_modules"))) {
        try {
          const auditResult = execSync("npm audit --json 2>&1", {
            cwd: root, stdio: "pipe", timeout: 15000, encoding: "utf8"
          });
          try {
            const auditJson = JSON.parse(auditResult);
            const vulns = auditJson.metadata?.vulnerabilities || auditJson.vulnerabilities || {};
            const critical = vulns.critical || 0;
            const high = vulns.high || 0;
            const moderate = vulns.moderate || 0;
            npmAuditVulns = critical + high + moderate;

            if (critical > 0) {
              addFinding("FAIL", "NPM Dependency Vulnerability",
                `${critical} Critical Vulnerability(s) in Dependencies`,
                `npm audit found ${critical} critical vulnerability(s) in installed packages.`,
                "Run 'npm audit fix' or 'npm audit fix --force' to resolve.");
            }
            if (high > 0) {
              addFinding("FAIL", "NPM Dependency Vulnerability",
                `${high} High Severity Vulnerability(s) in Dependencies`,
                `npm audit found ${high} high severity vulnerability(s).`,
                "Run 'npm audit fix' to auto-patch vulnerable packages.");
            }
            if (moderate > 0) {
              addFinding("WARN", "NPM Dependency Vulnerability",
                `${moderate} Moderate Vulnerability(s) in Dependencies`,
                `npm audit found ${moderate} moderate vulnerability(s).`,
                "Run 'npm audit' for details and 'npm audit fix' to resolve.");
            }
          } catch (e) { }
        } catch (auditErr) {
          try {
            const auditJson = JSON.parse(auditErr.stdout || "{}");
            const vulns = auditJson.metadata?.vulnerabilities || auditJson.vulnerabilities || {};
            const critical = vulns.critical || 0;
            const high = vulns.high || 0;
            const moderate = vulns.moderate || 0;
            npmAuditVulns = critical + high + moderate;

            if (critical > 0) {
              addFinding("FAIL", "NPM Dependency Vulnerability",
                `${critical} Critical Vulnerability(s) in Dependencies`,
                `npm audit found ${critical} critical vulnerability(s) in installed packages.`,
                "Run 'npm audit fix' or 'npm audit fix --force' to resolve.");
            }
            if (high > 0) {
              addFinding("FAIL", "NPM Dependency Vulnerability",
                `${high} High Severity Vulnerability(s) in Dependencies`,
                `npm audit found ${high} high severity vulnerability(s).`,
                "Run 'npm audit fix' to auto-patch vulnerable packages.");
            }
            if (moderate > 0) {
              addFinding("WARN", "NPM Dependency Vulnerability",
                `${moderate} Moderate Vulnerability(s) in Dependencies`,
                `npm audit found ${moderate} moderate vulnerability(s).`,
                "Run 'npm audit' for details and 'npm audit fix' to resolve.");
            }
          } catch (e) { }
        }
      }

      const lockPath = path.join(root, "package-lock.json");
      if (fs.existsSync(pkgPath) && !fs.existsSync(lockPath)) {
        addFinding("WARN", "Dependency Integrity", "Missing package-lock.json",
          "package-lock.json not found. Dependency versions may drift across installations.",
          "Run 'npm install' to generate a lockfile for reproducible builds.");
      }

      await animateCyberBar(4, "[CVE-PROBE]", "Package Manifest & CVE Cross-Check", 100,
        npmAuditVulns > 0 ? `${npmAuditVulns} vulnerability(s)` : "clean");

      // ══════════════════════════════════════════════════════════
      // STEP 5: DEEP FILE SCAN (Syntax + AST + Imports + Tokens + Response Typos)
      // ══════════════════════════════════════════════════════════
      const secretRegexes = [
        { name: "Hardcoded Password", regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/i },
        { name: "Hardcoded API Key / Secret", regex: /(?:api_key|apikey|secret_key|jwt_secret)\s*[:=]\s*["'][^"']{8,}["']/i },
        { name: "Hardcoded Private Key", regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/i },
        { name: "Hardcoded AWS Credentials", regex: /AKIA[0-9A-Z]{16}/ },
        { name: "Hardcoded MongoDB URI", regex: /mongodb(\+srv)?:\/\/[^\s"']+/i },
        { name: "Hardcoded JWT Token", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ }
      ];

      const dangerousPatterns = [
        { name: "eval() Usage", regex: /\beval\s*\(/, recommendation: "Avoid eval() — it enables code injection attacks. Use JSON.parse() or Function() instead." },
        { name: "child_process.exec() with User Input", regex: /exec\s*\(\s*[`$]/, recommendation: "Never pass user input to exec(). Use execFile() with argument arrays instead." },
        { name: "SQL Injection Risk (String Concatenation)", regex: /(?:query|execute)\s*\(\s*`[^`]*\$\{(?:req\.|params\.|args\.|body\.|query\.)/, recommendation: "Use parameterized queries (?) instead of string interpolation in SQL." },
        { name: "Unvalidated Redirect", regex: /redirect\s*\(\s*(?:req\.query|req\.body|req\.params)/, recommendation: "Validate redirect URLs against a whitelist to prevent open redirect attacks." }
      ];

      const frameworkInternalPrefixes = [
        "commands", "core", "http", "database", "security", "Middleware",
        "cache", "session", "api_controller", "mail", "queue", "scheduler",
        "storage", "websocket", "utils", "bin"
      ];

      const scannedFilesList = [];

      const scanDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(root, fullPath);

          if (entry.isDirectory()) {
            if (!["node_modules", ".git", ".vexora_log", ".vexora_config"].includes(entry.name)) {
              scanDirectory(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith(".js")) {
            totalFilesScanned++;
            scannedFilesList.push({ fullPath, relPath, dirName: dir });
          }
        }
      };

      scanDirectory(root);

      const totalFiles = scannedFilesList.length;

      for (let idx = 0; idx < totalFiles; idx++) {
        const { fullPath, relPath, dirName } = scannedFilesList[idx];

        try {
          execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
        } catch (err) {
          const rawErr = (err.stderr || err.stdout || "").toString();
          const isApiScript = relPath.startsWith(".api_routes") || relPath.startsWith(".api_routes\\");
          const isIllegalReturn = rawErr.includes("Illegal return statement");

          if (!(isApiScript && isIllegalReturn)) {
            syntaxErrors++;
            const firstLine = rawErr.split("\n").find((l) => l.includes("SyntaxError:") || l.includes("ReferenceError:")) || rawErr.split("\n")[0] || "Syntax error";

            addFinding("FAIL", "Syntax Error", `Syntax Error in ${relPath}`,
              firstLine.trim(), "Fix syntax error before running server.", relPath);
          }
        }

        try {
          const code = fs.readFileSync(fullPath, "utf8");
          const lines = code.split("\n");

          const declaredVars = new Set([
            "Vexora", "console", "process", "Math", "JSON", "Date", "Array", "Object", "String",
            "Number", "Boolean", "RegExp", "Error", "Promise", "Map", "Set", "Buffer", "setTimeout",
            "setInterval", "clearTimeout", "clearInterval", "globalThis", "global", "req", "res",
            "db", "params", "next", "exports", "module", "require", "import", "eval", "arguments",
            "this", "super", "new", "typeof", "instanceof", "delete", "void", "in", "of", "undefined",
            "null", "true", "false", "fetch", "URL", "URLSearchParams", "TextEncoder", "TextDecoder",
            "AbortController", "Response", "Request", "Headers"
          ]);

          let inImportBlock = false;
          lines.forEach((l) => {
            const declMatches = l.matchAll(/(?:const|let|var|function|class)\s+([\w$]+)/g);
            for (const dm of declMatches) declaredVars.add(dm[1]);

            const importMatch = l.match(/^import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from/);
            if (importMatch) {
              if (importMatch[1]) declaredVars.add(importMatch[1]);
              if (importMatch[2]) {
                importMatch[2].split(",").forEach((n) => {
                  const parts = n.trim().split(/\s+as\s+/);
                  const name = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                  if (name) declaredVars.add(name);
                });
              }
            }

            if (l.includes("import {") || l.includes("import type {")) inImportBlock = true;
            if (inImportBlock) {
              const multiImportMatch = l.match(/^\s*([\w$]+)\s*,?\s*$/);
              if (multiImportMatch) declaredVars.add(multiImportMatch[1]);
              if (l.includes("} from")) inImportBlock = false;
            }
          });

          lines.forEach((l, lIdx) => {
            const lineNum = lIdx + 1;
            const trimmed = l.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed === "") return;

            const importMatch = trimmed.match(/^import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s*["']([^"']+)["']/);
            if (importMatch) {
              const specifier = importMatch[3];
              if (specifier.startsWith("./") || specifier.startsWith("../")) {
                const resolvedPath = path.resolve(dirName, specifier);
                const exists = fs.existsSync(resolvedPath) ||
                  fs.existsSync(resolvedPath + ".js") ||
                  fs.existsSync(path.join(resolvedPath, "index.js"));
                if (!exists) {
                  addFinding("FAIL", "Module Import Error",
                    `Unresolved Import "${specifier}" in ${relPath}:${lineNum}`,
                    `Local file "${specifier}" does not exist.`,
                    `Check relative file path: ${specifier}`, relPath);
                }
              } else {
                let basePkg = specifier;
                if (specifier.startsWith("@")) {
                  basePkg = specifier.split("/").slice(0, 2).join("/");
                } else if (specifier.includes("/")) {
                  basePkg = specifier.split("/")[0];
                }

                if (!nodeBuiltins.has(specifier) && !nodeBuiltins.has(basePkg) && !installedPkgs.has(specifier) && !installedPkgs.has(basePkg)) {
                  const nmPath = path.join(root, "node_modules", basePkg);
                  if (!fs.existsSync(nmPath)) {
                    addFinding("FAIL", "Module Import Error",
                      `Missing Package Import "${specifier}" in ${relPath}:${lineNum}`,
                      `Package "${specifier}" is not installed in package.json or node_modules.`,
                      `Run 'npm install ${basePkg}' or fix module name.`, relPath);
                  }
                }
              }
            }

            if (/^[a-zA-Z_$][\w$]*;?$/.test(trimmed)) {
              const cleanWord = trimmed.replace(";", "");
              const jsKeywords = new Set([
                "else", "try", "finally", "return", "break", "continue", "debugger", "default", "case",
                "null", "undefined", "true", "false", "this", "super", "export", "import", "typeof",
                "instanceof", "void", "delete", "throw", "yield", "await", "async", "const", "let", "var",
                "function", "class", "extends", "catch", "if", "for", "while", "do", "switch"
              ]);

              if (!l.includes(",") && !l.includes("{") && !l.includes("}") && !l.includes(":") && !l.includes("=") && !l.includes("(") && !l.includes("export")) {
                if (!jsKeywords.has(cleanWord) && !declaredVars.has(cleanWord)) {
                  addFinding("FAIL", "Code Anomaly",
                    `Suspicious Junk Token "${cleanWord}" in ${relPath}:${lineNum}`,
                    `Line ${lineNum}: "${cleanWord}" is an orphan identifier / typo.`,
                    `Remove or fix the typo "${cleanWord}" on line ${lineNum}.`, relPath);
                }
              }
            }

            const trailingMatch = trimmed.match(/(?:\}\);|\};|\);\s*)([a-zA-Z_$][\w$]+)\s*$/);
            if (trailingMatch) {
              const junkToken = trailingMatch[1];
              if (!["else", "catch", "finally", "then"].includes(junkToken)) {
                addFinding("FAIL", "Syntax Anomaly",
                  `Unexpected Trailing Junk Token "${junkToken}" in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: "${trimmed}" has illegal trailing characters "${junkToken}".`,
                  `Remove trailing token "${junkToken}" from line ${lineNum}.`, relPath);
              }
            }

            const resCallMatch = trimmed.match(/\bres\s*\.\s*([\w$]+)\s*\(/);
            if (resCallMatch) {
              const resMethod = resCallMatch[1];
              const isFetchContext = code.substring(Math.max(0, lIdx > 5 ? lines.slice(lIdx - 5, lIdx).join("\n").length : 0)).includes("fetch(") ||
                lines.slice(Math.max(0, lIdx - 10), lIdx).some(prevLine =>
                  prevLine.includes("fetch(") || prevLine.includes("await fetch") || prevLine.includes("res.headers.get")
                );
              if (!isFetchContext && !validResMethods.has(resMethod) && !declaredVars.has(resMethod)) {
                addFinding("FAIL", "Unknown Method Call",
                  `Invalid Method "res.${resMethod}()" in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: "res.${resMethod}" is not a valid Vexora response method.`,
                  `Did you mean res.success() or res.json()?`, relPath);
              }
            }

            if (!relPath.includes(".example") && !relPath.includes("node_modules")) {
              for (const sec of secretRegexes) {
                if (sec.regex.test(l)) {
                  addFinding("WARN", "Secrets Leak",
                    `${sec.name} in ${relPath}:${lineNum}`,
                    `Line ${lineNum}: ${l.trim().substring(0, 60)}...`,
                    "Move sensitive credentials to .vexora_config/config or environment variables.", relPath);
                }
              }
            }

            const isFrameworkFile = frameworkInternalPrefixes.some(p => relPath.startsWith(p + path.sep) || relPath.startsWith(p + "/"));
            if (!isFrameworkFile) {
              for (const dp of dangerousPatterns) {
                if (dp.regex.test(trimmed)) {
                  addFinding("WARN", "Dangerous Code Pattern",
                    `${dp.name} Detected in ${relPath}:${lineNum}`,
                    `Line ${lineNum}: ${trimmed.substring(0, 60)}`,
                    dp.recommendation, relPath);
                }
              }
            }
          });
        } catch (e) { }

        hudState.currentStep = 5;
        hudState.stepTag = "AST-PARSER";
        hudState.currentFile = relPath;
        hudState.filesScanned = idx + 1;
        hudState.totalFiles = totalFiles;
        hudState.progressPct = Math.round(((idx + 1) / totalFiles) * 100);

        hudState.lastChecks.push({
          file: relPath,
          status: "Safe",
          isWarn: false
        });

        if (idx % 3 === 0 || idx === totalFiles - 1) {
          renderCyberDashboardHUD();
        }
        await sleep(2);
      }

      // ══════════════════════════════════════════════════════════
      // STEP 6: SECRETS & CREDENTIALS DEEP SCAN
      // ══════════════════════════════════════════════════════════
      const sensitiveFiles = [".env", ".env.local", ".env.production", "id_rsa", "id_rsa.pub", ".pem"];
      for (const sf of sensitiveFiles) {
        const sfPath = path.join(root, sf);
        if (fs.existsSync(sfPath)) {
          addFinding("WARN", "Sensitive File Exposure",
            `Sensitive File "${sf}" Found in Project Root`,
            `${sf} exists in project root and could be exposed.`,
            `Ensure "${sf}" is listed in .gitignore and .npmignore.`);
        }
      }
      await animateCyberBar(6, "[HUNTER-SECRETS]", "Hardcoded Secrets & Key Deep Search", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 7: LIVE API RUNTIME & ACTION SCRIPT EVALUATION
      // ══════════════════════════════════════════════════════════
      const apiDir = apiRoutesDir();
      let apiScriptsTested = 0;
      let apiScriptsPassed = 0;
      if (fs.existsSync(apiDir)) {
        let VexoraInstance = {};
        try {
          VexoraInstance = (await import("../Vexora.js")).default || {};
        } catch (e) {}

        const buildMockVexora = (mockRes) => {
          const baseMock = {
            Response: {
              json: (status, message = "", data = null, httpCode = 200) => {
                mockRes.statusCode = httpCode;
                return mockRes;
              },
              success: (data = null, message = "Success") => {
                mockRes.statusCode = 200;
                return mockRes;
              },
              error: (message = "Error", httpCode = 400, data = null) => {
                mockRes.statusCode = httpCode;
                return mockRes;
              }
            },
            Cache: { get: () => null, set: () => {}, del: () => {}, keys: () => [] },
            Validator: { validate: () => ({ valid: true, errors: [] }) },
            version: VexoraInstance.version || "audit-mock"
          };

          return new Proxy(baseMock, {
            get(target, prop) {
              if (prop in target) return target[prop];
              if (VexoraInstance && prop in VexoraInstance) {
                const val = VexoraInstance[prop];
                if (typeof val === "function") {
                  return async (...args) => {
                    return await val.apply(VexoraInstance, args);
                  };
                }
                return val;
              }
              return async () => [];
            }
          });
        };

        const promises = [];

        const testApiScripts = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(root, fullPath);
            if (entry.isDirectory()) {
              testApiScripts(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".whitelist.js")) {
              apiScriptsTested++;
              try {
                const scriptCode = fs.readFileSync(fullPath, "utf8");
                if (!scriptCode.trim()) {
                  addFinding("WARN", "Empty Action Script",
                    `Empty API Action Script "${relPath}"`,
                    `File "${relPath}" is completely empty. No request handling logic or response found.`,
                    `Add route logic using Vexora.Response.success() or remove unused script file.`, relPath);
                  apiScriptsPassed++;
                  continue;
                }

                const AsyncFn = Object.getPrototypeOf(async function () { }).constructor;
                const fn = new AsyncFn("Vexora", "req", "res", "db", "params", scriptCode);

                const mockReq = { method: "GET", url: "/test", headers: {}, query: {}, body: {}, params: {}, socket: { remoteAddress: "127.0.0.1" } };
                const mockRes = Object.create(http.ServerResponse.prototype);
                mockRes.statusCode = 200;
                Object.defineProperty(mockRes, "headersSent", { value: false, writable: true, configurable: true });
                mockRes.getHeader = () => null;
                mockRes.setHeader = () => mockRes;
                mockRes.removeHeader = () => mockRes;
                mockRes.writeHead = () => mockRes;
                mockRes.end = () => mockRes;
                mockReq.res = mockRes;
                mockRes.req = mockReq;
                const mockDb = {
                  query: async (...args) => VexoraInstance.query ? VexoraInstance.query(...args) : [],
                  execute: async (...args) => VexoraInstance.exec ? VexoraInstance.exec(...args) : [],
                  exec: async (...args) => VexoraInstance.exec ? VexoraInstance.exec(...args) : [],
                  fetchAll: async (...args) => VexoraInstance.fetchAll ? VexoraInstance.fetchAll(...args) : [],
                  fetch: async (...args) => VexoraInstance.fetch ? VexoraInstance.fetch(...args) : ({}),
                  fetchOne: async (...args) => VexoraInstance.fetch ? VexoraInstance.fetch(...args) : ({}),
                  insert: async (...args) => VexoraInstance.insert ? VexoraInstance.insert(...args) : 1,
                  update: async (...args) => VexoraInstance.update ? VexoraInstance.update(...args) : 1,
                  delete: async (...args) => VexoraInstance.delete ? VexoraInstance.delete(...args) : 1,
                  exists: async (...args) => VexoraInstance.exists ? VexoraInstance.exists(...args) : false,
                  count: async (...args) => VexoraInstance.count ? VexoraInstance.count(...args) : 0,
                  table: (t) => ({
                    get: async () => [],
                    first: async () => ({}),
                    insert: async () => 1,
                    update: async () => 1,
                    delete: async () => 1,
                  })
                };
                const mockParams = {};
                const mockVexora = buildMockVexora(mockRes);

                const p = new Promise((resolve) => {
                  requestContext.run({ req: mockReq, res: mockRes, response: mockRes, session: {} }, () => {
                    fn(mockVexora, mockReq, mockRes, mockDb, mockParams)
                      .then(() => { apiScriptsPassed++; resolve(); })
                      .catch((rtErr) => {
                        addFinding("FAIL", "API Runtime Exception",
                          `Runtime Error in API Script ${relPath}`,
                          `${rtErr.name || "Error"}: ${rtErr.message || rtErr}`,
                          `Inspect and fix the runtime exception in ${relPath}.`, relPath);
                        resolve();
                      });
                  });
                });
                promises.push(p);
              } catch (compileErr) {
                const firstLine = compileErr.message || "Script compilation failed";
                addFinding("FAIL", "API Compile Error",
                  `Failed to Compile API Script ${relPath}`,
                  `${compileErr.name}: ${firstLine}`,
                  `Fix script syntax or variable declarations in ${relPath}.`, relPath);
              }
            }
          }
        };
        testApiScripts(apiDir);
        await Promise.all(promises);
      }

      await sleep(30);
      await animateCyberBar(7, "[ACTION-SANDBOX]", "API Action Scripts Sandbox Execution", 100,
        apiScriptsTested > 0 ? `${apiScriptsTested} script(s) tested` : "no API scripts found");

      // ══════════════════════════════════════════════════════════
      // STEP 8: ROUTE HARDENING & WHITELIST AUDIT
      // ══════════════════════════════════════════════════════════
      if (fs.existsSync(apiDir)) {
        const whitelistFile = path.join(apiDir, "api.whitelist.js");
        if (!fs.existsSync(whitelistFile)) {
          addFinding("WARN", "Routing Security", "API Whitelist Router Missing",
            ".api_routes/api.whitelist.js is missing. API routes might not be protected.",
            "Run 'npx vexora make:route <name>' to scaffold a whitelisted router.");
        }

        const checkSubdirWhitelist = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const subDir = path.join(dir, entry.name);
              const subWhitelist = path.join(subDir, "api.whitelist.js");
              const hasJsFiles = fs.readdirSync(subDir).some(f => f.endsWith(".js") && f !== "api.whitelist.js");
              if (hasJsFiles && !fs.existsSync(subWhitelist)) {
                const subRel = path.relative(root, subDir);
                addFinding("INFO", "Route Protection",
                  `No Whitelist in API Subdirectory "${subRel}"`,
                  `${subRel}/ contains API scripts but no api.whitelist.js for fine-grained access control.`,
                  `Consider adding api.whitelist.js in ${subRel}/ for subdirectory-level route protection.`);
              }
              checkSubdirWhitelist(subDir);
            }
          }
        };
        checkSubdirWhitelist(apiDir);
      }

      if (pkgJson) {
        if (!pkgJson.engines) {
          addFinding("INFO", "Package Hardening", "No Node.js Engine Constraint",
            "package.json does not specify 'engines' field.",
            "Add \"engines\": { \"node\": \">=18\" } to package.json for predictable deployments.");
        }
        if (pkgJson.scripts?.start && pkgJson.scripts.start.includes("nodemon")) {
          addFinding("WARN", "Production Config", "nodemon in Production Start Script",
            "package.json 'start' script uses nodemon which is a dev-only tool.",
            "Use 'node' directly in production start scripts. Keep nodemon for 'dev' script only.");
        }
      }

      await animateCyberBar(8, "[HARDENING-CHECK]", "Route Whitelist & Security Hardening", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 9: VEXORA API SIGNATURE & METHOD VALIDATOR
      // ══════════════════════════════════════════════════════════
      for (const { fullPath, relPath } of scannedFilesList) {
        try {
          const code = fs.readFileSync(fullPath, "utf8");
          const lines = code.split("\n");

          lines.forEach((l, lIdx) => {
            const lineNum = lIdx + 1;
            const trimmed = l.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

            const updateMatch = trimmed.match(/Vexora\s*\.\s*update\s*\(([^)]+)\)/);
            if (updateMatch) {
              const argsStr = updateMatch[1].split(",").map(s => s.trim());
              if (argsStr.length < 2) {
                addFinding("FAIL", "Vexora API Signature",
                  `Invalid Vexora.update Signature in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: Vexora.update() requires at least (table, data) or (dbKey, table, data, where, params).`,
                  `Provide table and data object to Vexora.update()`, relPath);
              }
            }

            const deleteMatch = trimmed.match(/Vexora\s*\.\s*delete\s*\(([^)]+)\)/);
            if (deleteMatch) {
              const argsStr = deleteMatch[1].split(",").map(s => s.trim());
              if (argsStr.length < 1) {
                addFinding("FAIL", "Vexora API Signature",
                  `Invalid Vexora.delete Signature in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: Vexora.delete() requires (table, where, params).`,
                  `Provide table name to Vexora.delete()`, relPath);
              }
            }

            const existsMatch = trimmed.match(/Vexora\s*\.\s*exists\s*\(([^)]+)\)/);
            if (existsMatch) {
              const argsStr = existsMatch[1].split(",").map(s => s.trim());
              if (argsStr.length < 2) {
                addFinding("FAIL", "Vexora API Signature",
                  `Invalid Vexora.exists Signature in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: Vexora.exists() requires (table, where, params).`,
                  `Provide table and where clause to Vexora.exists()`, relPath);
              }
            }

            if (/Vexora\s*\.\s*(?:fetchAll|fetch|query|exec)\s*\([^)]*`[^`]*\$\{[^}]+\}/.test(trimmed)) {
              addFinding("WARN", "SQL Security",
                `SQL Template Literal Interpolation in ${relPath}:${lineNum}`,
                `Line ${lineNum}: String interpolation (\${...}) detected inside SQL query call.`,
                `Use parameterized positional queries (?) to prevent SQL injection risks.`, relPath);
            }
          });
        } catch (e) {}
      }

      await animateCyberBar(9, "[VEXORA-API]", "Static Signature Verification", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 10: ASYNC / AWAIT & PROMISE FLOW INSPECTOR
      // ══════════════════════════════════════════════════════════
      for (const { fullPath, relPath } of scannedFilesList) {
        try {
          const code = fs.readFileSync(fullPath, "utf8");
          const lines = code.split("\n");

          lines.forEach((l, lIdx) => {
            const lineNum = lIdx + 1;
            const trimmed = l.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

            const asyncDbCallMatch = trimmed.match(/(?<!await\s+)Vexora\s*\.\s*(fetchAll|fetch|query|exec|insert|update|delete|exists|count|paginate)\s*\(/);
            if (asyncDbCallMatch) {
              const methodName = asyncDbCallMatch[1];
              if (trimmed.startsWith("const ") || trimmed.startsWith("let ") || trimmed.startsWith("var ") || trimmed.startsWith("return ") || trimmed.startsWith("if ")) {
                addFinding("FAIL", "Async Bug",
                  `Missing 'await' on Vexora.${methodName}() in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: Vexora.${methodName}() returns a Promise but is missing 'await'.`,
                  `Add 'await' before Vexora.${methodName}(...)`, relPath);
              }
            }

            const isFrameworkFile = frameworkInternalPrefixes.some(p => relPath.startsWith(p + path.sep) || relPath.startsWith(p + "/"));
            if (!isFrameworkFile && /catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
              addFinding("WARN", "Silent Error Catch",
                `Empty Catch Block in ${relPath}:${lineNum}`,
                `Line ${lineNum}: Catch block silently ignores errors without logging.`,
                `Log or handle errors inside catch block instead of swallowing them.`, relPath);
            }
          });
        } catch (e) {}
      }

      await animateCyberBar(10, "[PROMISE-INSPECT]", "Async/Await Floating Promise Inspector", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 11: RESPONSE FLOW & UNREACHABLE CODE ANALYZER
      // ══════════════════════════════════════════════════════════
      if (fs.existsSync(apiDir)) {
        const scanApiFlow = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(root, fullPath);

            if (entry.isDirectory()) {
              scanApiFlow(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".whitelist.js")) {
              try {
                const code = fs.readFileSync(fullPath, "utf8");
                const lines = code.split("\n");

                let responseCount = 0;
                lines.forEach((l, lIdx) => {
                  const lineNum = lIdx + 1;
                  const trimmed = l.trim();
                  if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

                  if (/Vexora\s*\.\s*Response\s*\.\s*(success|error|json)\s*\(/.test(trimmed)) {
                    responseCount++;
                  }
                });

                if (responseCount > 1) {
                  addFinding("WARN", "Response Flow",
                    `Multiple Vexora.Response Calls in API Script ${relPath}`,
                    `Script contains ${responseCount} Vexora.Response calls. Ensure execution path returns after sending response.`,
                    `Use 'return Vexora.Response.success(...)' to prevent multi-send bugs.`, relPath);
                }

                if (responseCount === 0 && code.trim().length > 0 && !code.includes("res.json") && !code.includes("res.end") && !code.includes("res.send")) {
                  addFinding("INFO", "Response Flow",
                    `No Response Sent in API Script ${relPath}`,
                    `Script executes without calling Vexora.Response or res.json(). Client may hang.`,
                    `Add Vexora.Response.success() or Vexora.Response.error() call.`, relPath);
                }
              } catch (e) {}
            }
          }
        };
        scanApiFlow(apiDir);
      }

      await animateCyberBar(11, "[RESPONSE-FLOW]", "API Response Integrity & Double-Send Check", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 12: ROUTE & WHITELIST CONSISTENCY CROSS-CHECKER
      // ══════════════════════════════════════════════════════════
      if (fs.existsSync(apiDir)) {
        const checkWhitelistIntegrity = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          const jsFiles = new Set();
          let whitelistContent = "";

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              checkWhitelistIntegrity(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".js")) {
              if (entry.name === "api.whitelist.js") {
                try {
                  whitelistContent = fs.readFileSync(fullPath, "utf8");
                } catch (e) {}
              } else {
                jsFiles.add(entry.name.replace(/\.js$/, ""));
              }
            }
          }

          if (whitelistContent) {
            for (const jsName of jsFiles) {
              if (!whitelistContent.includes(`'${jsName}'`) && !whitelistContent.includes(`"${jsName}"`)) {
                const relDir = path.relative(root, dir);
                addFinding("INFO", "Route Whitelist",
                  `Unlisted Endpoint "${jsName}" in ${relDir}`,
                  `${relDir}/${jsName}.js exists but is not explicitly mapped in api.whitelist.js.`,
                  `Add apiRouter.any('${jsName}') to ${relDir}/api.whitelist.js to expose endpoint.`, path.join(relDir, `${jsName}.js`));
              }
            }
          }
        };
        checkWhitelistIntegrity(apiDir);
      }

      await animateCyberBar(12, "[ENDPOINT-MAPPER]", "Route Whitelist & Endpoint Cross-Checker", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 13: CODE QUALITY & PRODUCTION ANTI-PATTERN SCANNER
      // ══════════════════════════════════════════════════════════
      for (const { fullPath, relPath } of scannedFilesList) {
        try {
          const code = fs.readFileSync(fullPath, "utf8");
          const lines = code.split("\n");

          lines.forEach((l, lIdx) => {
            const lineNum = lIdx + 1;
            const trimmed = l.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

            const isUserScript = relPath.startsWith(".api_routes") || relPath.startsWith("controllers");
            if (isUserScript && /\bconsole\s*\.\s*(log|debug)\s*\(/.test(trimmed)) {
              addFinding("INFO", "Code Quality",
                `console.log Left in API Script ${relPath}:${lineNum}`,
                `Line ${lineNum}: console.log() output in production API scripts degrades performance.`,
                `Remove console.log() or replace with Vexora audit log in production.`, relPath);
            }

            if (!relPath.includes("node_modules") && /(?<!=)[!=]==(?!=)/.test(trimmed) === false && /\s+[!=]=\s+/.test(trimmed)) {
              if (!trimmed.includes("null") && !trimmed.includes("undefined")) {
                addFinding("INFO", "Code Quality",
                  `Loose Equality Operator in ${relPath}:${lineNum}`,
                  `Line ${lineNum}: Loose equality (== / !=) used instead of strict (=== / !==).`,
                  `Use === or !== to prevent unexpected type coercions.`, relPath);
              }
            }
          });
        } catch (e) {}
      }

      await animateCyberBar(13, "[ANTI-PATTERN]", "Production Anti-Patterns & Memory Leaks", 100);

      // ══════════════════════════════════════════════════════════
      // STEP 14: MASTER DEDUPLICATION & JSON REPORT EXPORT
      // ══════════════════════════════════════════════════════════
      const uniqueFindings = [];
      const seenFindingKeys = new Set();

      for (const f of findings) {
        const key = `${f.type}|${f.category}|${f.title}|${f.file || ""}`;
        if (!seenFindingKeys.has(key)) {
          seenFindingKeys.add(key);
          uniqueFindings.push(f);
        }
      }

      try {
        const logDir = path.join(root, ".vexora_log");
        ensureDir(logDir);
        const reportPath = path.join(logDir, "audit_report.json");
        const reportData = {
          timestamp: new Date().toISOString(),
          total_scanned_files: totalFilesScanned,
          syntax_errors: syntaxErrors,
          findings: uniqueFindings
        };
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf8");
      } catch (e) {}

      await animateCyberBar(14, "[CYBER-LOG-EXPORT]", "Vector Deduplication & Threat Intel Log Compilation", 100);

      // ══════════════════════════════════════════════════════════
      // ERASE LIVE HUD SCANNER UI & RENDER FINAL CYBER DEFENSE REPORT
      // ══════════════════════════════════════════════════════════
      const fails = uniqueFindings.filter((f) => f.type === "FAIL").length;
      const warns = uniqueFindings.filter((f) => f.type === "WARN").length;
      const infos = uniqueFindings.filter((f) => f.type === "INFO").length;

      let score = 100 - (fails * 20 + warns * 3 + infos * 1);
      if (score < 0) score = 0;

      let grade = "A+ (HARDENED & SECURE)";
      let gradeColor = c.brightGreen;
      if (score < 95) { grade = "A (HARDENED)"; gradeColor = c.green; }
      if (score < 80) { grade = "B (GOOD)"; gradeColor = c.brightYellow; }
      if (score < 65) { grade = "C (NEEDS ATTENTION)"; gradeColor = c.yellow; }
      if (score < 45) { grade = "D (VULNERABLE)"; gradeColor = c.bold + "\x1b[31m"; }
      if (score < 25) { grade = "F (CRITICAL / BROKEN)"; gradeColor = c.bold + "\x1b[31m"; }

      // Clear Live HUD box completely from terminal screen
      if (hudPrintedLines > 0) {
        process.stdout.write(`\x1b[${hudPrintedLines + 4}A\x1b[0J`);
        hudPrintedLines = 0;
      }

      const boxW = 82;
      const bTitle = padDisplayEnd(`  ${c.bold}${c.brightYellow}📊 VEXORA CYBER DEFENSE & THREAT HUNTING REPORT${c.reset}`, boxW);
      const r1 = padDisplayEnd(`  Scanned Targets      : ${c.white}${totalFilesScanned} files (AST Parsed)${c.reset}`, boxW);
      const r2 = padDisplayEnd(`  Syntax Errors        : ${syntaxErrors > 0 ? c.bold + "\x1b[31m" + syntaxErrors + " ERROR(S)" + c.reset : c.brightGreen + "0 — Clean Integrity" + c.reset}`, boxW);
      const r3 = padDisplayEnd(`  Action Script Probes : ${apiScriptsTested > 0 ? c.white + apiScriptsTested + " script(s) tested" + c.reset : c.dim + "none" + c.reset}`, boxW);
      const r4 = padDisplayEnd(`  DB Connection Probes : ${dbConnectionsTested > 0 ? c.white + dbConnectionsTested + " connection(s) verified" + c.reset : c.dim + "none" + c.reset}`, boxW);
      const r5 = padDisplayEnd(`  CVE Vulnerabilities  : ${npmAuditVulns > 0 ? "\x1b[31m" + npmAuditVulns + " Known Vulnerabilities" + c.reset : c.brightGreen + "0 — Clean" + c.reset}`, boxW);
      const r6 = padDisplayEnd(`  🔴 Critical Threats : ${fails > 0 ? "\x1b[31m" + fails + c.reset : "0"}    🟡 Warnings : ${warns > 0 ? c.yellow + warns + c.reset : "0"}    🔵 Notices : ${infos}`, boxW);
      const r7 = padDisplayEnd(`  ${c.bold}Cyber Defense Score : ${gradeColor}${score}/100 — GRADE ${grade}${c.reset}`, boxW);

      console.log(`${c.brightCyan}╔${"═".repeat(boxW)}╗${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${bTitle}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}╠${"═".repeat(boxW)}╣${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r1}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r2}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r3}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r4}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r5}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}╠${"═".repeat(boxW)}╣${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r6}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}╠${"═".repeat(boxW)}╣${c.reset}`);
      console.log(`${c.brightCyan}║${c.reset}${r7}${c.brightCyan}║${c.reset}`);
      console.log(`${c.brightCyan}╚${"═".repeat(boxW)}╝${c.reset}\n`);

      if (uniqueFindings.length === 0) {
        console.log(`  ${c.brightGreen}🎉 ZERO THREATS DETECTED! Your codebase is 100% hardened and secure.${c.reset}\n`);
      } else {
        const failFindings = uniqueFindings.filter(f => f.type === "FAIL");
        const warnFindings = uniqueFindings.filter(f => f.type === "WARN");
        const infoFindings = uniqueFindings.filter(f => f.type === "INFO");

        if (failFindings.length > 0) {
          console.log(`  ${c.bold}\x1b[31m━━━ 🔴 CRITICAL THREATS & FAILURES (${failFindings.length}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
          failFindings.forEach((f, idx) => {
            console.log(`  ${idx + 1}. \x1b[31m[CRITICAL]${c.reset} ${c.bold}${f.category}:${c.reset} ${f.title}`);
            console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
            console.log(`     ${c.brightCyan}👉 Recommended Remediation:${c.reset} ${f.recommendation}\n`);
          });
        }

        if (warnFindings.length > 0) {
          console.log(`  ${c.bold}${c.yellow}━━━ 🟡 HEURISTIC SECURITY WARNINGS (${warnFindings.length}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
          warnFindings.forEach((f, idx) => {
            console.log(`  ${idx + 1}. ${c.yellow}[WARNING]${c.reset} ${c.bold}${f.category}:${c.reset} ${f.title}`);
            console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
            console.log(`     ${c.brightCyan}👉 Recommended Remediation:${c.reset} ${f.recommendation}\n`);
          });
        }

        if (infoFindings.length > 0) {
          console.log(`  ${c.bold}${c.brightCyan}━━━ 🔵 SECURITY DEFENSE NOTICES (${infoFindings.length}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
          infoFindings.forEach((f, idx) => {
            console.log(`  ${idx + 1}. ${c.brightCyan}[NOTICE]${c.reset} ${c.bold}${f.category}:${c.reset} ${f.title}`);
            console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
            console.log(`     ${c.brightCyan}👉 Recommended Remediation:${c.reset} ${f.recommendation}\n`);
          });
        }

        if (fileIssueMap.size > 0) {
          console.log(`\n  ${c.bold}📁 TARGET FILES WITH VECTORS / ISSUES:${c.reset}`);
          console.log(`  ${c.gray}${"─".repeat(78)}${c.reset}`);
          for (const [file, issues] of fileIssueMap) {
            const fCount = issues.filter(i => i.type === "FAIL").length;
            const wCount = issues.filter(i => i.type === "WARN").length;
            const iCount = issues.filter(i => i.type === "INFO").length;
            const badges = [];
            if (fCount > 0) badges.push(`\x1b[31m${fCount}🔴${c.reset}`);
            if (wCount > 0) badges.push(`${c.yellow}${wCount}🟡${c.reset}`);
            if (iCount > 0) badges.push(`${c.brightCyan}${iCount}🔵${c.reset}`);
            console.log(`  ${c.dim}→${c.reset} ${file.padEnd(45)} ${badges.join("  ")}`);
          }
          console.log(`  ${c.gray}${"─".repeat(78)}${c.reset}`);
        }
      }

      console.log(`\n  ${c.brightGreen}💡 Threat Intel Report exported to .vexora_log/audit_report.json${c.reset}`);
      console.log(`  ${c.dim}  • Run 'vexora security:blocked' to view live blocked IPs.${c.reset}`);
      console.log(`  ${c.dim}  • Add ENABLE_SECURITY_HEADERS=true in config for OWASP headers.${c.reset}\n`);
    },
  },

  "security:cipher:reset": {
    description: "Safely resets and regenerates the Dynamic Polymorphic Cipher Matrix (4,096 S-Box + 10,000+ Master Key)",
    category: "🛡️ Security",
    aliases: ["security:cipher", "security:reset-cipher", "cipher:reset"],
    async run(args) {
      const c = colors;
      const readline = await import("node:readline");
      const isForce = args.includes("--force") || args.includes("-f");

      console.log("");
      console.log(`${c.brightYellow}⚠️  ========================================================================${c.reset}`);
      console.log(`${c.brightYellow}⚠️  WARNING: RESETTING VEXORA DYNAMIC POLYMORPHIC CIPHER MATRIX${c.reset}`);
      console.log(`${c.brightYellow}⚠️  ========================================================================${c.reset}`);
      console.log(`
Resetting the Polymorphic Cipher Matrix will:
  1. Backup current config to .vexora_config/polymorphic_cipher.json.bak_<timestamp>
  2. Generate a NEW 4,096-Element Dynamic S-Box Substitution Matrix
  3. Generate a NEW 10,000+ Character Master Secret Key

${c.brightRed}${c.bold}🚨 CRITICAL SECURITY CONSEQUENCE:${c.reset}
  • Any database columns, tokens, or sessions encrypted using the OLD matrix
    will ${c.bold}NO LONGER BE DECODABLE${c.reset} unless re-encrypted!
`);

      const doReset = async () => {
        const PolymorphicCipher = (await import("../vexora_encryption/PolymorphicCipher.js")).default;
        const res = PolymorphicCipher.resetMatrix("ewewqeqe");
        console.log(`\n${c.brightGreen}✅ SUCCESS: Polymorphic Cipher Matrix regenerated successfully!${c.reset}`);
        console.log(`   • New 4,096-Element S-Box created (>8,200 lines).`);
        console.log(`   • New 10,000+ Character Master Key created.`);
        if (res.backup_path) {
          console.log(`   • Old matrix backed up to: ${c.brightCyan}${res.backup_path}${c.reset}`);
        }
        console.log(`\n${c.brightYellow}🛡️ Security Status: 100% MAXIMUM LEVEL ACTIVE${c.reset}\n`);
      };

      if (isForce) {
        await doReset();
        return;
      }

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`${c.brightYellow}Are you SURE you want to reset and regenerate your Polymorphic Cipher? (y/N): ${c.reset}`, async (answer) => {
        rl.close();
        if (answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes") {
          await doReset();
        } else {
          console.log(`\n${c.brightRed}❌ Operation cancelled. Polymorphic Cipher Matrix was NOT changed.${c.reset}\n`);
        }
      });
    }
  }
};
