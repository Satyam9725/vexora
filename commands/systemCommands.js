/**
 * Vexora Framework - System Commands & Professional CLI Table Renderer
 */

import fs from "node:fs";
import path from "node:path";
import { colors, promptQuestion, line } from "./helpers.js";

export const systemCommands = {
  "info": {
    description: "Displays system memory & framework stats",
    category: "ℹ️ System",
    aliases: ["sys:info"],
    async run() {
      const c = colors;
      const mem = process.memoryUsage();
      let version = "1.4.5";
      try {
        const pkgPath = path.join(process.cwd(), "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          if (pkg.version) version = pkg.version;
        }
      } catch (e) {}

      const nowStr = new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });

      const fields = [
        ["Framework", `Vexora Engine v${version}`],
        ["Node.js", process.version],
        ["Platform", `${process.platform} (${process.arch})`],
        ["Current Time", nowStr],
        ["RSS Memory", `${(mem.rss / 1024 / 1024).toFixed(2)} MB`],
        ["Heap Used", `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`],
        ["Heap Total", `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`],
        ["Uptime", `${process.uptime().toFixed(2)}s`],
        ["PID", String(process.pid)],
        ["CWD", process.cwd()]
      ];

      const boxWidth = 66;

      console.log("");
      console.log(`${c.gray}╔${"═".repeat(boxWidth)}╗${c.reset}`);
      const title = "🚀 VEXORA ENGINE — SYSTEM DIAGNOSTICS";
      const titlePad = Math.max(0, boxWidth - title.length - 2);
      console.log(`${c.gray}║${c.reset}  ${c.bold}${c.brightCyan}${title}${c.reset}${" ".repeat(titlePad)}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╠${"═".repeat(boxWidth)}╣${c.reset}`);

      for (const [label, val] of fields) {
        const labelPadded = label.padEnd(14);
        const maxValLen = boxWidth - 19;
        const valTrunc = val.length > maxValLen ? val.substring(0, maxValLen - 3) + "..." : val;
        const linePad = Math.max(0, boxWidth - 19 - valTrunc.length);
        console.log(`${c.gray}║${c.reset}  ${c.cyan}${labelPadded}${c.reset} : ${c.white}${valTrunc}${c.reset}${" ".repeat(linePad)}${c.gray}║${c.reset}`);
      }

      console.log(`${c.gray}╚${"═".repeat(boxWidth)}╝${c.reset}`);
      console.log("");
    },
  },

  "contact": {
    description: "Displays author contact & GitHub link",
    category: "ℹ️ System",
    aliases: ["github", "author"],
    async run() {
      const c = colors;
      const githubUrl = "https://github.com/Satyam9725/vexora";
      const hyperLink = `\x1b]8;;${githubUrl}\x1b\\${c.brightCyan}${c.underline}${githubUrl}${c.reset}\x1b]8;;\x1b\\`;

      console.log(`
${c.gray}╔══════════════════════════════════════════════════════════════╗${c.reset}
${c.gray}║${c.reset}  ${c.bold}${c.brightYellow}📞 VEXORA FRAMEWORK — AUTHOR & CONTACT${c.reset}                      ${c.gray}║${c.reset}
${c.gray}╠══════════════════════════════════════════════════════════════╣${c.reset}
${c.gray}║${c.reset}  ${c.cyan}Author${c.reset}   : ${c.white}Satyam Kumar${c.reset}                                   ${c.gray}║${c.reset}
${c.gray}║${c.reset}  ${c.cyan}Email${c.reset}    : ${c.white}satyam.ku9725@gmail.com${c.reset}                       ${c.gray}║${c.reset}
${c.gray}║${c.reset}  ${c.cyan}Phone${c.reset}    : ${c.white}+91 9725399936${c.reset}                                 ${c.gray}║${c.reset}
${c.gray}║${c.reset}  ${c.cyan}GitHub${c.reset}   : ${hyperLink}         ${c.gray}║${c.reset}
${c.gray}╚══════════════════════════════════════════════════════════════╝${c.reset}
`);
    },
  }
};

// ══════════════════════════════════════════════════════════
// PROFESSIONAL CLI TABLE RENDERER WITH INTERACTIVE MENU
// ══════════════════════════════════════════════════════════

export async function renderHelpUI(allCommands, interactive = true) {
  const c = colors;
  const githubUrl = "https://github.com/Satyam9725/vexora";
  const hyperLink = `\x1b]8;;${githubUrl}\x1b\\${c.brightCyan}${c.underline}${githubUrl}${c.reset}\x1b]8;;\x1b\\`;

  let version = "1.4.6";
  try {
    const Vexora = (await import("../Vexora.js")).default;
    version = Vexora.version || version;
  } catch (e) {}

  // ── ASCII BANNER ──────────────────────────────────────
  console.log(`
${c.cyan}${c.bold}  ██╗   ██╗███████╗██╗  ██╗ ██████╗ ██████╗  █████╗ 
  ██║   ██║██╔════╝╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗
  ██║   ██║█████╗   ╚███╔╝ ██║   ██║██████╔╝███████║
  ╚██╗ ██╔╝██╔══╝   ██╔██╗ ██║   ██║██╔══██╗██╔══██║
   ╚████╔╝ ███████╗██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║
    ╚═══╝  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝${c.reset}
`);

  // ── WELCOME BOX ───────────────────────────────────────
  const verLabel = `(v${version})`;
  const verPadded = verLabel.padEnd(8);
  console.log(`${c.gray}╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.gray}║${c.reset}  ${c.bold}${c.brightYellow}🚀 WELCOME TO VEXORA SERVER ENGINE CLI${c.reset} ${c.dim}${verPadded}${c.reset}                                                        ${c.gray}║${c.reset}`);
  console.log(`${c.gray}║${c.reset}  ${c.green}⚡ Blazing-Fast, Zero-Dependency Backend Framework for Node.js${c.reset}                                      ${c.gray}║${c.reset}`);
  console.log(`${c.gray}║${c.reset}  ${c.cyan}👤 Author:${c.reset} Satyam Kumar  ${c.dim}|${c.reset}  ${c.cyan}📞${c.reset} +91 9725399936  ${c.dim}|${c.reset}  ${c.magenta}🌐${c.reset} ${hyperLink}                  ${c.gray}║${c.reset}`);
  console.log(`${c.gray}╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);

  if (interactive) {
    const answer = await promptQuestion("View all CLI Helper Commands & Options? (y/n)", "n");
    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log(`\n  ${c.brightYellow}💡${c.reset} Type ${c.green}npx vexora list${c.reset} or ${c.green}npx vexora help${c.reset} to view all commands.\n`);
      return;
    }
  }

  // ── BUILD DEDUPLICATED COMMAND LIST ───────────────────
  // Collect all alias names mapped to their parent command
  const aliasToParent = new Map();
  for (const [name, cmd] of Object.entries(allCommands)) {
    if (cmd.aliases) {
      for (const a of cmd.aliases) aliasToParent.set(a, name);
    }
  }

  // Group commands by category, skip entries that are aliases of another command
  const categories = {};
  const flatList = []; // For interactive selection by serial number
  const seenNames = new Set(); // Track already-added commands

  for (const [name, cmd] of Object.entries(allCommands)) {
    // Skip 'list' command row as requested
    if (name === "list") continue;
    // Skip if this command name is registered as an alias of a different command
    if (aliasToParent.has(name) && aliasToParent.get(name) !== name) continue;
    // Skip if we've already seen this command
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    // Normalize category name (strip variation selectors to prevent duplicate categories)
    const rawCat = cmd.category || "Other";
    const cat = rawCat.replace(/\uFE0E|\uFE0F/g, "").trim();
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ name, ...cmd });
  }

  // ── RENDER TABLE ──────────────────────────────────────
  const col0 = 5;  // Serial number column
  const col1 = 42;
  const col2 = 56;
  const totalW = col0 + col1 + col2 + 5;

  console.log("");
  console.log(`  ${c.bold}${c.brightCyan}📋 VEXORA CLI — COMPLETE COMMANDS REFERENCE${c.reset}`);
  console.log(`  ${c.dim}Type a serial number to run a command interactively${c.reset}`);
  console.log("");

  // Top border
  console.log(`  ${c.gray}╔${"═".repeat(col0 + 1)}╦${"═".repeat(col1 + 1)}╦${"═".repeat(col2 + 1)}╗${c.reset}`);
  // Header row
  console.log(`  ${c.gray}║${c.reset} ${c.bold}${c.brightCyan}${"#".padEnd(col0)}${c.reset} ${c.gray}║${c.reset} ${c.bold}${c.brightCyan}${"COMMAND".padEnd(col1)}${c.reset} ${c.gray}║${c.reset} ${c.bold}${c.brightCyan}${"DESCRIPTION".padEnd(col2)}${c.reset} ${c.gray}║${c.reset}`);

  let serialNum = 0;

  for (const [category, cmds] of Object.entries(categories)) {
    // Category separator
    console.log(`  ${c.gray}╠${"═".repeat(col0 + 1)}╬${"═".repeat(col1 + 1)}╬${"═".repeat(col2 + 1)}╣${c.reset}`);
    const catLabel = ` ${category}`;
    console.log(`  ${c.gray}║${c.reset} ${"".padEnd(col0)} ${c.gray}║${c.reset} ${c.bold}${c.brightYellow}${catLabel.padEnd(col1)}${c.reset} ${c.gray}║${c.reset} ${"".padEnd(col2)} ${c.gray}║${c.reset}`);
    console.log(`  ${c.gray}╠${"═".repeat(col0 + 1)}╬${"═".repeat(col1 + 1)}╬${"═".repeat(col2 + 1)}╣${c.reset}`);

    cmds.forEach((cmd, i) => {
      serialNum++;
      const usageStr = cmd.usage || cmd.name;
      const cmdStr = `npx vexora ${usageStr}`;
      const cmdPadded = cmdStr.length > col1 ? cmdStr.substring(0, col1 - 2) + ".." : cmdStr.padEnd(col1);
      const descPadded = cmd.description.length > col2 ? cmd.description.substring(0, col2 - 2) + ".." : cmd.description.padEnd(col2);
      const numStr = String(serialNum).padStart(3);

      // Store in flat list for interactive selection
      flatList.push({ serial: serialNum, name: cmd.name, usage: usageStr, cmd });

      console.log(`  ${c.gray}║${c.reset} ${c.brightYellow}${numStr}${c.reset}${" ".repeat(col0 - 3)} ${c.gray}║${c.reset} ${c.green}${cmdPadded}${c.reset} ${c.gray}║${c.reset} ${c.white}${descPadded}${c.reset} ${c.gray}║${c.reset}`);

      // Light row separator within category (except last row)
      if (i < cmds.length - 1) {
        console.log(`  ${c.gray}║${"─".repeat(col0 + 1)}║${"─".repeat(col1 + 1)}║${"─".repeat(col2 + 1)}║${c.reset}`);
      }
    });
  }

  // Bottom border
  console.log(`  ${c.gray}╚${"═".repeat(col0 + 1)}╩${"═".repeat(col1 + 1)}╩${"═".repeat(col2 + 1)}╝${c.reset}`);

  // Footer
  console.log("");
  console.log(`  ${c.gray}${"─".repeat(totalW + 2)}${c.reset}`);
  console.log(`  ${c.dim}💡 Tip: Click the GitHub link above to open repository.${c.reset}`);
  console.log(`  ${c.dim}📌 All generators create production-ready boilerplate with best practices.${c.reset}`);
  console.log(`  ${c.gray}${"─".repeat(totalW + 2)}${c.reset}`);
  console.log("");

  // ── INTERACTIVE COMMAND RUNNER (LOOP) ─────────────────
  if (interactive) {
    while (true) {
      const choice = await promptQuestion(`Enter command # to run (1-${serialNum}), or press Enter to exit`, "");
      if (!choice) break;

      const num = parseInt(choice);
      if (isNaN(num) || num < 1 || num > serialNum) {
        console.log(`  ${c.brightYellow}❌${c.reset} Invalid selection. Try again or press Enter to exit.\n`);
        continue;
      }

      const selected = flatList.find(f => f.serial === num);
      if (!selected) continue;

      // Extract required (<arg>) and optional ([arg]) arguments from usage (skip [options], [flags], etc.)
      const usageArgs = selected.usage
        ? [...selected.usage.matchAll(/[<\[]([^\]>]+)[>\]]/g)]
            .map(m => m[1])
            .filter(a => !["options", "flags", "..."].includes(a.toLowerCase()))
        : [];
      let finalArgs = [selected.name];

      if (usageArgs.length > 0) {
        for (const argName of usageArgs) {
          const argVal = await promptQuestion(
            `📝 Enter ${argName} (Usage: npx vexora ${selected.usage || selected.name})`,
            ""
          );
          if (argVal) finalArgs.push(argVal);
        }
      }

      // Confirmation
      const cmdDisplay = `npx vexora ${finalArgs.join(" ")}`;
      const confirm = await promptQuestion(`Run "${cmdDisplay}"? (y/n)`, "y");
      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log(`  ${c.dim}⏹ Cancelled.${c.reset}\n`);
        continue;
      }

      console.log(`\n  ${c.brightCyan}▶ Running:${c.reset} ${c.green}${cmdDisplay}${c.reset}\n`);

      try {
        await selected.cmd.run(finalArgs);
      } catch (err) {
        console.error(`  ${c.brightYellow}❌ Error:${c.reset} ${err.message}`);
      }

      console.log(`\n  ${c.gray}${"─".repeat(60)}${c.reset}`);
      console.log(`  ${c.dim}✅ Command finished. Select another or press Enter to exit.${c.reset}`);
      console.log(`  ${c.gray}${"─".repeat(60)}${c.reset}\n`);
    }
  }
}
