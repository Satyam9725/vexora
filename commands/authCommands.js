/**
 * Vexora Framework - Authentication & CLI Session Commands
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { vexoraConfigDir, ensureDir, colors } from "./helpers.js";
import { renderHelpUI } from "./systemCommands.js";

export function getAuthFilePath() {
  return path.join(vexoraConfigDir(), "auth.json");
}

export function clearAuthSession() {
  const authPath = getAuthFilePath();
  if (fs.existsSync(authPath)) {
    try {
      fs.unlinkSync(authPath);
    } catch {}
  }
}

export function isAuthenticated() {
  const authPath = getAuthFilePath();
  if (!fs.existsSync(authPath)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(authPath, "utf8"));
    if (!data || data.status !== "authenticated") return false;

    // Strict Terminal Process Session Check: If terminal PID changed or terminal closed, auto-logout
    if (data.terminalPid && data.terminalPid !== process.ppid) {
      clearAuthSession();
      return false;
    }

    // Session 24-hour expiration check
    if (data.expiresAt && Date.now() > data.expiresAt) {
      clearAuthSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const authCommands = {
  "login": {
    description: "Instant 1-click login for Vexora CLI session",
    category: "🔐 Auth",
    aliases: ["auth:login"],
    async run(args, allCommands) {
      ensureDir(vexoraConfigDir());
      const authPath = getAuthFilePath();

      const sessionId = `vx_sess_${crypto.randomBytes(12).toString("hex")}`;
      const authData = {
        status: "authenticated",
        user: "Vexora Developer",
        role: "admin",
        sessionId: sessionId,
        terminalPid: process.ppid,
        loggedInAt: new Date().toISOString(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), "utf8");

      console.log(`\n${colors.cyan}========================================================================${colors.reset}`);
      console.log(`  ${colors.brightGreen}${colors.bold}🔐 VEXORA CLI AUTHENTICATION SUCCESSFUL${colors.reset}`);
      console.log(`${colors.cyan}========================================================================${colors.reset}`);
      console.log(`  ${colors.bold}👤 User       :${colors.reset} ${authData.user} (${authData.role})`);
      console.log(`  ${colors.bold}🔑 Session ID :${colors.reset} ${authData.sessionId}`);
      console.log(`  ${colors.bold}📅 Logged In  :${colors.reset} ${new Date(authData.loggedInAt).toLocaleString()}`);
      console.log(`${colors.cyan}========================================================================${colors.reset}\n`);

      // If a subcommand was chained (e.g. vexora login security:cipher:reset), run it immediately
      if (args[1] && allCommands) {
        const subCmdName = args[1];
        let subCmd = allCommands[subCmdName];
        if (!subCmd) {
          for (const [name, cmd] of Object.entries(allCommands)) {
            if (cmd.aliases && cmd.aliases.includes(subCmdName)) {
              subCmd = cmd;
              break;
            }
          }
        }
        if (subCmd) {
          await subCmd.run(args.slice(1), allCommands);
          return;
        }
      }

      // Render original interactive help UI with y/n prompt unless in test/non-interactive mode
      const isNonInteractive = args.includes("--no-interactive") || args.includes("-n") || process.env.NODE_ENV === "test";
      if (allCommands && !isNonInteractive) {
        await renderHelpUI(allCommands, true);
      }
    },
  },

  "whoami": {
    description: "Displays current logged-in Vexora CLI user",
    category: "🔐 Auth",
    aliases: ["auth:whoami", "auth:status"],
    async run() {
      const authPath = getAuthFilePath();
      if (!fs.existsSync(authPath) || !isAuthenticated()) {
        console.log(`\n${colors.yellow}⚠️ Not logged in. Run '${colors.brightGreen}vexora login${colors.yellow}' to log in instantly.${colors.reset}\n`);
        return;
      }

      try {
        const authData = JSON.parse(fs.readFileSync(authPath, "utf8"));
        console.log(`\n${colors.cyan}==========================================================${colors.reset}`);
        console.log(`${colors.brightCyan}${colors.bold}  👤 ACTIVE VEXORA CLI SESSION${colors.reset}`);
        console.log(`${colors.cyan}==========================================================${colors.reset}`);
        console.log(`  ${colors.bold}Status     :${colors.reset} ${colors.green}ACTIVE${colors.reset}`);
        console.log(`  ${colors.bold}User       :${colors.reset} ${authData.user}`);
        console.log(`  ${colors.bold}Role       :${colors.reset} ${authData.role}`);
        console.log(`  ${colors.bold}Session ID :${colors.reset} ${authData.sessionId}`);
        console.log(`  ${colors.bold}Logged In  :${colors.reset} ${new Date(authData.loggedInAt).toLocaleString()}`);
        console.log(`${colors.cyan}==========================================================${colors.reset}\n`);
      } catch (err) {
        console.log(`\n${colors.yellow}⚠️ Invalid session file. Run '${colors.brightGreen}vexora login${colors.yellow}' to re-authenticate.${colors.reset}\n`);
      }
    },
  },

  "logout": {
    description: "Log out from Vexora CLI session",
    category: "🔐 Auth",
    aliases: ["auth:logout"],
    async run() {
      clearAuthSession();
      console.log(`\n${colors.brightGreen}✅ Successfully logged out from Vexora CLI.${colors.reset}\n`);
    },
  },
};
