/**
 * Vexora Framework - Master Security & Code Analyzer
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { rootDir, vexoraConfigDir, apiRoutesDir, line, colors } from "./helpers.js";

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
  "text", "writeHead", "on", "once", "emit", "removeHeader", "getHeader", "hasHeader", "getHeaderNames",
  "getHeaders", "uncork", "cork", "flushHeaders", "assignSocket", "detachSocket"
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
        console.error("   Usage: node Vexora security:unblock <ip>");
        process.exit(1);
      }
      const MemoryCache = (await import("../cache/MemoryCache.js")).default;
      const ipToUnblock = args[1].trim();
      MemoryCache.del("temp_blocked_ip:" + ipToUnblock);
      console.log(`✅ Unblocked IP ${ipToUnblock} from memory cache shield.`);
    },
  },

  "security:audit": {
    description: "Runs full security vulnerability & code audit scanner",
    category: "🛡️ Security",
    aliases: ["security:scan", "security:analyzer", ":scan", "scan"],
    async run() {
      const c = colors;
      const root = rootDir();
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Read installed dependencies from package.json
      const pkgPath = path.join(root, "package.json");
      const installedPkgs = new Set(["vexora"]);
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}) };
          Object.keys(allDeps).forEach((d) => installedPkgs.add(d));
        } catch (e) {}
      }

      console.log("");
      console.log(`${c.gray}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
      console.log(`${c.gray}║${c.reset}  ${c.bold}${c.brightYellow}🛡️ VEXORA MASTER SECURITY ANALYZER — CODEBASE & CONFIG AUDIT${c.reset}              ${c.gray}║${c.reset}`);
      console.log(`${c.gray}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
      console.log(`  ${c.brightCyan}🚀 Initializing Master Security Engine...${c.reset}\n`);

      const findings = [];
      let totalFilesScanned = 0;
      let syntaxErrors = 0;

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

      // ── STEP 1: CONFIGURATION AUDIT ───────────────────────
      const configPath = path.join(vexoraConfigDir(), "config");
      if (!fs.existsSync(configPath)) {
        findings.push({
          type: "WARN",
          category: "Configuration",
          title: "Config File Missing",
          details: ".vexora_config/config not found. Default fallback settings will be used.",
          recommendation: "Run your server once or run 'node Vexora reset:config' to generate it."
        });
      } else {
        const configContent = fs.readFileSync(configPath, "utf8");
        const configMap = {};
        configContent.split("\n").forEach((l) => {
          const trimmed = l.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const idx = trimmed.indexOf("=");
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim();
            configMap[key] = val;
          }
        });

        if (configMap["CORS_ORIGINS"] === "*") {
          findings.push({
            type: "WARN",
            category: "CORS Security",
            title: "Permissive Wildcard CORS Origin",
            details: "CORS_ORIGINS is set to '*' allowing any domain to send cross-origin requests.",
            recommendation: "In production, restrict CORS_ORIGINS to specific trusted domains."
          });
        }
        if (configMap["DETECT_BOT_BEHAVIOR"] === "false") {
          findings.push({
            type: "WARN",
            category: "Bot Shield",
            title: "Bot Behavior Detection Disabled",
            details: "DETECT_BOT_BEHAVIOR is set to false. Automated bot shielding is turned off.",
            recommendation: "Set DETECT_BOT_BEHAVIOR=true in .vexora_config/config."
          });
        }
        if (configMap["ENABLE_SECURITY_HEADERS"] === "false") {
          findings.push({
            type: "FAIL",
            category: "HTTP Security",
            title: "Security Headers Disabled",
            details: "ENABLE_SECURITY_HEADERS is set to false. Security headers are disabled.",
            recommendation: "Set ENABLE_SECURITY_HEADERS=true in .vexora_config/config."
          });
        }
        if (!configMap["CSRF_SECRET"] || configMap["CSRF_SECRET"].length < 8) {
          findings.push({
            type: "INFO",
            category: "CSRF Guard",
            title: "CSRF Secret Key Unset",
            details: "CSRF_SECRET is empty or short. Auto-generated session keys will be used.",
            recommendation: "Set a strong random string for CSRF_SECRET in .vexora_config/config."
          });
        }
      }
      await animateProgressBar(`${c.yellow}[1/5]${c.reset} ⚙️  Auditing Master Configuration (.vexora_config/config)`, 180);

      // ── STEP 2: HEADERS & SHIELD AUDIT ────────────────────
      await animateProgressBar(`${c.yellow}[2/5]${c.reset} 🛡️  Auditing DDoS Shield, Bot Analyzer & HTTP Security Headers`, 180);

      // ── STEP 3: LIVE FILE SCAN WITH CLEAN PROGRESS BAR ─────
      console.log(`  ${c.yellow}[3/5]${c.reset} ⚡  Parsing JavaScript Files & Verifying ES Module Syntax...`);

      const secretRegexes = [
        { name: "Hardcoded Password", regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/i },
        { name: "Hardcoded API Key / Secret", regex: /(?:api_key|apikey|secret_key|jwt_secret)\s*[:=]\s*["'][^"']{8,}["']/i },
        { name: "Hardcoded Private Key", regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/i },
        { name: "Hardcoded AWS Credentials", regex: /AKIA[0-9A-Z]{16}/ }
      ];

      const scannedFilesList = [];

      const scanDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(root, fullPath);

          if (entry.isDirectory()) {
            if (!["node_modules", ".git", ".vexora_log"].includes(entry.name)) {
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
        let fileHasIssue = false;

        // 1. Native Node.js Syntax Check
        try {
          execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
        } catch (err) {
          syntaxErrors++;
          fileHasIssue = true;
          const rawErr = (err.stderr || err.stdout || "").toString();
          const firstLine = rawErr.split("\n").find((l) => l.includes("SyntaxError:") || l.includes("ReferenceError:")) || rawErr.split("\n")[0] || "Syntax error";

          findings.push({
            type: "FAIL",
            category: "Syntax Error",
            title: `Syntax Error in ${relPath}`,
            details: firstLine.trim(),
            recommendation: "Fix syntax error before running server."
          });
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
            "null", "true", "false"
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
                  const name = n.trim().split(/\s+as\s+/)[0].trim();
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

          // PASS 2: Scan for unresolved imports, secrets leaks, invalid method calls, trailing junk tokens
          lines.forEach((l, lIdx) => {
            const lineNum = lIdx + 1;
            const trimmed = l.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

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
                  fileHasIssue = true;
                  findings.push({
                    type: "FAIL",
                    category: "Module Import Error",
                    title: `Unresolved Import "${specifier}" in ${relPath}:${lineNum}`,
                    details: `Local file "${specifier}" does not exist.`,
                    recommendation: `Check relative file path: ${specifier}`
                  });
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
                    fileHasIssue = true;
                    findings.push({
                      type: "FAIL",
                      category: "Module Import Error",
                      title: `Missing Package Import "${specifier}" in ${relPath}:${lineNum}`,
                      details: `Package "${specifier}" is not installed in package.json or node_modules.`,
                      recommendation: `Run 'npm install ${basePkg}' or fix module name.`
                    });
                  }
                }
              }
            }

            // Check standalone undeclared junk tokens (e.g. "sssss" on line 2 or 5)
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
                  fileHasIssue = true;
                  findings.push({
                    type: "FAIL",
                    category: "Code Anomaly",
                    title: `Suspicious Junk Token "${cleanWord}" in ${relPath}:${lineNum}`,
                    details: `Line ${lineNum}: "${cleanWord}" is an orphan identifier / typo.`,
                    recommendation: `Remove or fix the typo "${cleanWord}" on line ${lineNum}.`
                  });
                }
              }
            }

            // Check trailing junk tokens after statements (e.g. "});ssss" on line 9)
            const trailingMatch = trimmed.match(/(?:\}\);|\};|\);\s*)([a-zA-Z_$][\w$]+)\s*$/);
            if (trailingMatch) {
              const junkToken = trailingMatch[1];
              if (!["else", "catch", "finally", "then"].includes(junkToken)) {
                fileHasIssue = true;
                findings.push({
                  type: "FAIL",
                  category: "Syntax Anomaly",
                  title: `Unexpected Trailing Junk Token "${junkToken}" in ${relPath}:${lineNum}`,
                  details: `Line ${lineNum}: "${trimmed}" has illegal trailing characters "${junkToken}".`,
                  recommendation: `Remove trailing token "${junkToken}" from line ${lineNum}.`
                });
              }
            }

            // Check response method typos (e.g. "res.succsssssess(...)")
            const resCallMatch = trimmed.match(/\bres\s*\.\s*([\w$]+)\s*\(/);
            if (resCallMatch) {
              const resMethod = resCallMatch[1];
              if (!validResMethods.has(resMethod) && !declaredVars.has(resMethod)) {
                fileHasIssue = true;
                findings.push({
                  type: "FAIL",
                  category: "Unknown Method Call",
                  title: `Invalid Method "res.${resMethod}()" in ${relPath}:${lineNum}`,
                  details: `Line ${lineNum}: "res.${resMethod}" is not a valid Vexora response method.`,
                  recommendation: `Did you mean res.success() or res.json()?`
                });
              }
            }

            // Secrets leak check
            if (!relPath.includes(".example")) {
              for (const sec of secretRegexes) {
                if (sec.regex.test(l)) {
                  findings.push({
                    type: "WARN",
                    category: "Secrets Leak",
                    title: `${sec.name} in ${relPath}:${lineNum}`,
                    details: `Line ${lineNum}: ${l.trim().substring(0, 50)}...`,
                    recommendation: "Move sensitive credentials to .vexora_config/config or environment variables."
                  });
                }
              }
            }
          });
        } catch (e) {}

        // Render live progress bar without cluttering screen with 100 log lines
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

      // ── STEP 4: SECRETS SCAN ──────────────────────────────
      await animateProgressBar(`${c.yellow}[4/5]${c.reset} 🔑  Scanning Codebase for Hardcoded Secrets & Credentials`, 150);

      // ── STEP 5: ROUTE HARDENING AUDIT ─────────────────────
      const apiDir = apiRoutesDir();
      if (fs.existsSync(apiDir)) {
        const whitelistFile = path.join(apiDir, "api.whitelist.js");
        if (!fs.existsSync(whitelistFile)) {
          findings.push({
            type: "WARN",
            category: "Routing Security",
            title: "API Whitelist Router Missing",
            details: ".api_routes/api.whitelist.js is missing. API routes might not be protected.",
            recommendation: "Run 'node Vexora make:route <name>' to scaffold a whitelisted router."
          });
        }
      }
      await animateProgressBar(`${c.yellow}[5/5]${c.reset} 📌  Validating Whitelisted API Routers & Endpoints`, 150);

      // ── RENDER SUMMARY REPORT & FINDINGS ──────────────────
      const fails = findings.filter((f) => f.type === "FAIL").length;
      const warns = findings.filter((f) => f.type === "WARN").length;
      const infos = findings.filter((f) => f.type === "INFO").length;

      let score = 100 - (fails * 25 + warns * 10 + infos * 2);
      if (score < 0) score = 0;

      let grade = "A+ (EXCELLENT)";
      let gradeColor = c.brightGreen;
      if (score < 90) { grade = "A (HARDENED)"; gradeColor = c.green; }
      if (score < 75) { grade = "B (MODERATE)"; gradeColor = c.yellow; }
      if (score < 60) { grade = "C (NEEDS ATTENTION)"; gradeColor = c.brightYellow; }
      if (score < 40) { grade = "F (VULNERABLE / BROKEN)"; gradeColor = c.bold + "\x1b[31m"; }

      console.log(`  ${c.bold}📊 AUDIT STATS:${c.reset}`);
      console.log(`     Files Scanned   : ${c.white}${totalFilesScanned}${c.reset}`);
      console.log(`     Syntax Errors   : ${syntaxErrors > 0 ? c.bold + "\x1b[31m" + syntaxErrors + " ERRORS" : c.green + "0 ERRORS"}${c.reset}`);
      console.log(`     Failures (❌)   : ${fails > 0 ? "\x1b[31m" + fails : "0"}${c.reset}`);
      console.log(`     Warnings (⚠️)   : ${warns > 0 ? c.yellow + warns : "0"}${c.reset}`);
      console.log(`     Notices  (ℹ️)   : ${infos}${c.reset}`);
      console.log(`     Security Score  : ${gradeColor}${score}/100 — GRADE ${grade}${c.reset}\n`);

      line();
      console.log(`  ${c.bold}${c.brightCyan}📋 DETAILED FINDINGS & FIX RECOMMENDATIONS:${c.reset}`);
      line();

      if (findings.length === 0) {
        console.log(`  ${c.brightGreen}🎉 CONGRATULATIONS! No security vulnerabilities or syntax errors found.${c.reset}`);
        console.log(`  ${c.dim}Your Vexora codebase and configuration are hardened according to best practices.${c.reset}\n`);
      } else {
        findings.forEach((f, idx) => {
          let badge = `${c.brightGreen}[INFO]${c.reset}`;
          if (f.type === "WARN") badge = `${c.yellow}[WARNING]${c.reset}`;
          if (f.type === "FAIL") badge = `\x1b[31m[FAILURE]${c.reset}`;

          console.log(`  ${idx + 1}. ${badge} ${c.bold}${f.category}: ${f.title}${c.reset}`);
          console.log(`     ${c.dim}Details:${c.reset} ${f.details}`);
          console.log(`     ${c.brightCyan}👉 Fix:${c.reset} ${f.recommendation}`);
          console.log("");
        });
      }

      line();
      console.log(`  ${c.dim}💡 Tip: Run 'node Vexora security:blocked' to view live blocked IPs.${c.reset}\n`);
    },
  }
};
