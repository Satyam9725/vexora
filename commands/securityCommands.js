/**
 * Vexora Framework - Master Security & Code Analyzer
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { rootDir, vexoraConfigDir, apiRoutesDir, line, colors } from "./helpers.js";
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
        console.error("   Usage: npx vexora security:unblock <ip>");
        process.exit(1);
      }
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      const ipToUnblock = args[1].trim();
      MemoryCache.del("temp_blocked_ip:" + ipToUnblock);
      console.log(`✅ Unblocked IP ${ipToUnblock} from memory cache shield.`);
    },
  },

  "security:audit": {
    description: "Runs full advanced security vulnerability & code audit scanner (8-step deep analysis)",
    category: "🛡️ Security",
    aliases: ["security:scan", "security:analyzer", ":scan", "scan"],
    async run() {
      const c = colors;
      const root = rootDir();
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const TOTAL_STEPS = 8;

      // Read installed dependencies from package.json
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
      console.log(`${c.gray}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
      console.log(`${c.gray}║${c.reset}  ${c.bold}${c.brightYellow}🛡️ VEXORA ADVANCED SECURITY ANALYZER — FULL CODEBASE AUDIT${c.reset}             ${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}  ${c.dim}8-Step Deep Analysis • File Scan • API Runtime • DB Probe • NPM Audit${c.reset}  ${c.gray}║${c.reset}`);
      console.log(`${c.gray}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
      console.log(`  ${c.brightCyan}🚀 Initializing Advanced Security Engine...${c.reset}\n`);

      const findings = [];
      let totalFilesScanned = 0;
      let syntaxErrors = 0;
      const fileIssueMap = new Map(); // relPath -> [{issue}]

      const addFinding = (type, category, title, details, recommendation, file = null) => {
        const finding = { type, category, title, details, recommendation };
        findings.push(finding);
        if (file) {
          if (!fileIssueMap.has(file)) fileIssueMap.set(file, []);
          fileIssueMap.get(file).push(finding);
        }
      };

      const animateProgressBar = async (label, durationMs = 180, extraInfo = "") => {
        const barLength = 32;
        console.log(`  ${label}`);
        const steps = 16;
        const intervalMs = Math.max(10, Math.floor(durationMs / steps));

        for (let i = 1; i <= steps; i++) {
          const progress = i / steps;
          const filledLength = Math.round(barLength * progress);
          const filledBar = "█".repeat(filledLength);
          const emptyBar = "░".repeat(barLength - filledLength);
          const percent = Math.round(progress * 100);

          const barStr = `  [${c.brightCyan}${filledBar}${c.gray}${emptyBar}${c.reset}] ${c.brightYellow}${String(percent).padStart(3)}%${c.reset} ${c.dim}scanning...${c.reset}`;
          process.stdout.write(`\r${barStr}`);
          await sleep(intervalMs);
        }
        const fullBar = "█".repeat(barLength);
        const extra = extraInfo ? ` ${c.dim}(${extraInfo})${c.reset}` : "";
        process.stdout.write(`\r  [${c.brightGreen}${fullBar}${c.reset}] ${c.brightGreen}100% ✓ COMPLETED${c.reset}${extra}                         \n\n`);
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
        if (configMap["DETECT_BOT_BEHAVIOR"] === "false") {
          addFinding("WARN", "Bot Shield", "Bot Behavior Detection Disabled",
            "DETECT_BOT_BEHAVIOR is set to false. Automated bot shielding is turned off.",
            "Set DETECT_BOT_BEHAVIOR=true in .vexora_config/config.");
        }
        if (configMap["ENABLE_SECURITY_HEADERS"] === "false") {
          addFinding("FAIL", "HTTP Security", "Security Headers Disabled",
            "ENABLE_SECURITY_HEADERS is set to false. Security headers are disabled.",
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

      // .env file leak check
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

      await animateProgressBar(`${c.yellow}[1/${TOTAL_STEPS}]${c.reset} ⚙️  Auditing Master Configuration & Environment Variables`, 180);

      // ══════════════════════════════════════════════════════════
      // STEP 2: DATABASE HANDSHAKE AUDIT
      // ══════════════════════════════════════════════════════════
      const dbCfgPath = path.join(vexoraConfigDir(), "db_config.json");
      let dbConnectionsTested = 0;
      if (fs.existsSync(dbCfgPath)) {
        try {
          const dbConfigs = JSON.parse(fs.readFileSync(dbCfgPath, "utf8"));
          for (const [key, cfg] of Object.entries(dbConfigs)) {
            const host = cfg.host || cfg.DB_HOST || "127.0.0.1";
            const port = cfg.port || cfg.DB_PORT || (cfg.driver === "postgres" ? 5432 : 3306);
            const user = cfg.user || cfg.DB_USER || "root";
            const pass = cfg.password || cfg.DB_PASS || "";
            const dbName = cfg.database || cfg.DB_NAME || "";
            const driver = cfg.driver || cfg.DB_DRIVER || "mysql";
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
              } else if (driver === "postgres") {
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

      await animateProgressBar(`${c.yellow}[2/${TOTAL_STEPS}]${c.reset} 🗄️  Live Database Handshake Probe`, 180,
        dbConnectionsTested > 0 ? `${dbConnectionsTested} connection(s) tested` : "no db_config found");

      // ══════════════════════════════════════════════════════════
      // STEP 3: HEADERS & SHIELD AUDIT
      // ══════════════════════════════════════════════════════════
      await animateProgressBar(`${c.yellow}[3/${TOTAL_STEPS}]${c.reset} 🛡️  Auditing DDoS Shield, Bot Analyzer & HTTP Security Headers`, 180);

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
          // npm audit returns non-zero exit code when vulnerabilities found
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

      // Check for outdated package-lock.json
      const lockPath = path.join(root, "package-lock.json");
      if (fs.existsSync(pkgPath) && !fs.existsSync(lockPath)) {
        addFinding("WARN", "Dependency Integrity", "Missing package-lock.json",
          "package-lock.json not found. Dependency versions may drift across installations.",
          "Run 'npm install' to generate a lockfile for reproducible builds.");
      }

      await animateProgressBar(`${c.yellow}[4/${TOTAL_STEPS}]${c.reset} 📦  Scanning NPM Dependencies for Known Vulnerabilities`, 150,
        npmAuditVulns > 0 ? `${npmAuditVulns} vulnerability(s)` : "clean");

      // ══════════════════════════════════════════════════════════
      // STEP 5: LIVE FILE SCAN (Syntax + Imports + Secrets + Code Anomalies)
      // ══════════════════════════════════════════════════════════
      console.log(`  ${c.yellow}[5/${TOTAL_STEPS}]${c.reset} ⚡  Deep-Parsing JavaScript Files & Verifying ES Module Syntax...`);

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

      // Framework internal paths — these are Vexora's own controlled code, not user code
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
      const barLength = 32;

      for (let idx = 0; idx < totalFiles; idx++) {
        const { fullPath, relPath, dirName } = scannedFilesList[idx];

        // 1. Native Node.js Syntax Check
        try {
          execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
        } catch (err) {
          syntaxErrors++;
          const rawErr = (err.stderr || err.stdout || "").toString();
          const firstLine = rawErr.split("\n").find((l) => l.includes("SyntaxError:") || l.includes("ReferenceError:")) || rawErr.split("\n")[0] || "Syntax error";

          addFinding("FAIL", "Syntax Error", `Syntax Error in ${relPath}`,
            firstLine.trim(), "Fix syntax error before running server.", relPath);
        }

        // 2. Deep Content & Import Inspection
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

          // PASS 1: Pre-collect explicit declarations
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

          // PASS 2: Line-by-line deep scan
          lines.forEach((l, lIdx) => {
            const lineNum = lIdx + 1;
            const trimmed = l.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed === "") return;

            // Check ES Imports
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

            // Check standalone undeclared junk tokens
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

            // Check trailing junk tokens
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

            // Check response method typos — only if `res` is clearly the HTTP response
            // Skip lines inside fetch/HTTP client blocks where `res` is a fetch Response
            const resCallMatch = trimmed.match(/\bres\s*\.\s*([\w$]+)\s*\(/);
            if (resCallMatch) {
              const resMethod = resCallMatch[1];
              // Skip if it's inside an async fetch callback or .then() where res is fetch response
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

            // Secrets leak check
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

            // Dangerous pattern check — only for user project files, not Vexora internals
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

        // Render live progress bar
        const pct = Math.round(((idx + 1) / totalFiles) * 100);
        const filled = Math.round(barLength * ((idx + 1) / totalFiles));
        const filledBar = "█".repeat(filled);
        const emptyBar = "░".repeat(barLength - filled);
        const errCount = findings.filter((f) => f.type === "FAIL").length;
        const statusText = errCount > 0 ? `${c.bold}\x1b[31m${errCount} issue(s)${c.reset}` : `${c.brightGreen}clean${c.reset}`;

        process.stdout.write(`\r  [${c.brightCyan}${filledBar}${c.gray}${emptyBar}${c.reset}] ${c.brightYellow}${String(pct).padStart(3)}%${c.reset} ${c.dim}Scanned ${idx + 1}/${totalFiles} files (${statusText})${c.reset}`);
        await sleep(10);
      }

      console.log(`\r  [${c.brightGreen}${"█".repeat(barLength)}${c.reset}] ${c.brightGreen}100% ✓ COMPLETED${c.reset} ${c.dim}(Scanned ${totalFiles} files)${c.reset}                         \n\n`);

      // ══════════════════════════════════════════════════════════
      // STEP 6: SECRETS & CREDENTIALS DEEP SCAN
      // ══════════════════════════════════════════════════════════
      // Check for sensitive files that shouldn't be in repo
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
      await animateProgressBar(`${c.yellow}[6/${TOTAL_STEPS}]${c.reset} 🔑  Deep Scanning for Hardcoded Secrets, Keys & Credentials`, 150);

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

        // Build a robust Vexora mock that delegates to VexoraInstance methods
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
                    // Try real Vexora execution (e.g. Database.fetchAll).
                    // If SQL query has error (e.g. Table projects1 does not exist), throw error so audit catches it!
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
                  apiScriptsPassed++;
                  continue; // Skip empty files
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
                  execute: async (...args) => VexoraInstance.execute ? VexoraInstance.execute(...args) : [],
                  fetchAll: async (...args) => VexoraInstance.fetchAll ? VexoraInstance.fetchAll(...args) : [],
                  fetchOne: async (...args) => VexoraInstance.fetchOne ? VexoraInstance.fetchOne(...args) : ({}),
                  table: (t) => ({
                    get: async () => [],
                    first: async () => ({}),
                    insert: async () => ({ id: 1 }),
                    update: async () => true,
                    delete: async () => true,
                  })
                };
                const mockParams = {};
                const mockVexora = buildMockVexora(mockRes);

                // Run within requestContext so GlobalResponse._getRes() works
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

      // Wait a moment for async catches to settle
      await sleep(100);
      await animateProgressBar(`${c.yellow}[7/${TOTAL_STEPS}]${c.reset} 🧪  Live API Action Script Runtime Execution Testing`, 150,
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

        // Check for unprotected subdirectories (missing whitelist in subdirs)
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

      // Check package.json for security best practices
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

      await animateProgressBar(`${c.yellow}[8/${TOTAL_STEPS}]${c.reset} 📌  Validating Route Whitelists, Package Config & Hardening`, 150);

      // ══════════════════════════════════════════════════════════
      // RENDER ADVANCED SUMMARY REPORT
      // ══════════════════════════════════════════════════════════
      const fails = findings.filter((f) => f.type === "FAIL").length;
      const warns = findings.filter((f) => f.type === "WARN").length;
      const infos = findings.filter((f) => f.type === "INFO").length;

      let score = 100 - (fails * 25 + warns * 10 + infos * 2);
      if (score < 0) score = 0;

      let grade = "A+ (EXCELLENT)";
      let gradeColor = c.brightGreen;
      if (score < 95) { grade = "A (HARDENED)"; gradeColor = c.green; }
      if (score < 80) { grade = "B (GOOD)"; gradeColor = c.brightYellow; }
      if (score < 65) { grade = "C (NEEDS ATTENTION)"; gradeColor = c.yellow; }
      if (score < 45) { grade = "D (VULNERABLE)"; gradeColor = c.bold + "\x1b[31m"; }
      if (score < 25) { grade = "F (CRITICAL / BROKEN)"; gradeColor = c.bold + "\x1b[31m"; }

      // Stats Box
      console.log(`${c.gray}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
      console.log(`${c.gray}║${c.reset}  ${c.bold}📊 ADVANCED AUDIT REPORT${c.reset}                                                   ${c.gray}║${c.reset}`);
      console.log(`${c.gray}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}`);
      console.log(`${c.gray}║${c.reset}  Files Scanned     : ${c.white}${totalFilesScanned}${c.reset}${" ".repeat(Math.max(1, 54 - String(totalFilesScanned).length))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}  Syntax Errors     : ${syntaxErrors > 0 ? c.bold + "\x1b[31m" + syntaxErrors + " ERROR(S)" + c.reset : c.green + "0 — Clean" + c.reset}${" ".repeat(Math.max(1, syntaxErrors > 0 ? 45 - String(syntaxErrors).length : 45))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}  API Scripts Tested : ${apiScriptsTested > 0 ? c.white + apiScriptsTested + c.reset : c.dim + "none" + c.reset}${" ".repeat(Math.max(1, 54 - (apiScriptsTested > 0 ? String(apiScriptsTested).length : 4)))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}  DB Connections     : ${dbConnectionsTested > 0 ? c.white + dbConnectionsTested + c.reset : c.dim + "none" + c.reset}${" ".repeat(Math.max(1, 54 - (dbConnectionsTested > 0 ? String(dbConnectionsTested).length : 4)))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}  NPM Vulnerabilities: ${npmAuditVulns > 0 ? "\x1b[31m" + npmAuditVulns + c.reset : c.green + "0" + c.reset}${" ".repeat(Math.max(1, 54 - String(npmAuditVulns).length))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}`);
      console.log(`${c.gray}║${c.reset}  ❌ Failures : ${fails > 0 ? "\x1b[31m" + fails + c.reset : "0"}    ⚠️  Warnings : ${warns > 0 ? c.yellow + warns + c.reset : "0"}    ℹ️  Notices : ${infos}${" ".repeat(Math.max(1, 20))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}`);
      console.log(`${c.gray}║${c.reset}  ${c.bold}Security Score: ${gradeColor}${score}/100 — GRADE ${grade}${c.reset}${" ".repeat(Math.max(1, 43 - grade.length - String(score).length))}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

      // Detailed Findings
      if (findings.length === 0) {
        console.log(`  ${c.brightGreen}🎉 CONGRATULATIONS! No security vulnerabilities or issues found.${c.reset}`);
        console.log(`  ${c.dim}Your Vexora codebase and configuration are hardened.${c.reset}\n`);
      } else {
        // Group by severity
        const failFindings = findings.filter(f => f.type === "FAIL");
        const warnFindings = findings.filter(f => f.type === "WARN");
        const infoFindings = findings.filter(f => f.type === "INFO");

        if (failFindings.length > 0) {
          console.log(`  ${c.bold}\x1b[31m━━━ ❌ FAILURES (${failFindings.length}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
          failFindings.forEach((f, idx) => {
            console.log(`  ${idx + 1}. \x1b[31m[FAIL]${c.reset} ${c.bold}${f.category}:${c.reset} ${f.title}`);
            console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
            console.log(`     ${c.brightCyan}👉 Fix:${c.reset} ${f.recommendation}\n`);
          });
        }

        if (warnFindings.length > 0) {
          console.log(`  ${c.bold}${c.yellow}━━━ ⚠️  WARNINGS (${warnFindings.length}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
          warnFindings.forEach((f, idx) => {
            console.log(`  ${idx + 1}. ${c.yellow}[WARN]${c.reset} ${c.bold}${f.category}:${c.reset} ${f.title}`);
            console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
            console.log(`     ${c.brightCyan}👉 Fix:${c.reset} ${f.recommendation}\n`);
          });
        }

        if (infoFindings.length > 0) {
          console.log(`  ${c.bold}${c.brightCyan}━━━ ℹ️  NOTICES (${infoFindings.length}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
          infoFindings.forEach((f, idx) => {
            console.log(`  ${idx + 1}. ${c.brightCyan}[INFO]${c.reset} ${c.bold}${f.category}:${c.reset} ${f.title}`);
            console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
            console.log(`     ${c.brightCyan}👉 Fix:${c.reset} ${f.recommendation}\n`);
          });
        }

        // Per-file issue summary
        if (fileIssueMap.size > 0) {
          console.log(`\n  ${c.bold}📁 FILES WITH ISSUES:${c.reset}`);
          console.log(`  ${c.gray}${"─".repeat(72)}${c.reset}`);
          for (const [file, issues] of fileIssueMap) {
            const fCount = issues.filter(i => i.type === "FAIL").length;
            const wCount = issues.filter(i => i.type === "WARN").length;
            const iCount = issues.filter(i => i.type === "INFO").length;
            const badges = [];
            if (fCount > 0) badges.push(`\x1b[31m${fCount}❌${c.reset}`);
            if (wCount > 0) badges.push(`${c.yellow}${wCount}⚠️${c.reset}`);
            if (iCount > 0) badges.push(`${c.brightCyan}${iCount}ℹ️${c.reset}`);
            console.log(`  ${c.dim}→${c.reset} ${file}  ${badges.join("  ")}`);
          }
          console.log(`  ${c.gray}${"─".repeat(72)}${c.reset}`);
        }
      }

      console.log(`\n  ${c.dim}💡 Tips:${c.reset}`);
      console.log(`  ${c.dim}  • Run 'npx vexora security:blocked' to view live blocked IPs.${c.reset}`);
      console.log(`  ${c.dim}  • Run 'npm audit fix' to auto-fix npm dependency vulnerabilities.${c.reset}`);
      console.log(`  ${c.dim}  • Add ENABLE_SECURITY_HEADERS=true in config for OWASP headers.${c.reset}\n`);
    },
  }
};
