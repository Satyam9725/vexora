/**
 * Vexora Framework - System Commands & Professional CLI Table Renderer
 */

import fs from "node:fs";
import path from "node:path";
import { colors, promptQuestion, line, padDisplayEnd, getDisplayWidth } from "./helpers.js";

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
      const titleLine = padDisplayEnd(`  ${c.bold}${c.brightCyan}${title}${c.reset}`, boxWidth);
      console.log(`${c.gray}║${c.reset}${titleLine}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╠${"═".repeat(boxWidth)}╣${c.reset}`);

      for (const [label, val] of fields) {
        const labelPadded = label.padEnd(14);
        const maxValLen = boxWidth - 19;
        const valTrunc = val.length > maxValLen ? val.substring(0, maxValLen - 3) + "..." : val;
        const rowStr = padDisplayEnd(`  ${c.cyan}${labelPadded}${c.reset} : ${c.white}${valTrunc}${c.reset}`, boxWidth);
        console.log(`${c.gray}║${c.reset}${rowStr}${c.gray}║${c.reset}`);
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

      const boxW = 62;
      const title = padDisplayEnd(`  ${c.bold}${c.brightYellow}📞 VEXORA FRAMEWORK — AUTHOR & CONTACT${c.reset}`, boxW);
      const row1 = padDisplayEnd(`  ${c.cyan}Author${c.reset}   : ${c.white}Satyam Kumar${c.reset}`, boxW);
      const row2 = padDisplayEnd(`  ${c.cyan}Email${c.reset}    : ${c.white}satyam.ku9725@gmail.com${c.reset}`, boxW);
      const row3 = padDisplayEnd(`  ${c.cyan}Phone${c.reset}    : ${c.white}+91 9725399936${c.reset}`, boxW);
      const row4 = padDisplayEnd(`  ${c.cyan}GitHub${c.reset}   : ${hyperLink}`, boxW);

      console.log("");
      console.log(`${c.gray}╔${"═".repeat(boxW)}╗${c.reset}`);
      console.log(`${c.gray}║${c.reset}${title}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╠${"═".repeat(boxW)}╣${c.reset}`);
      console.log(`${c.gray}║${c.reset}${row1}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}${row2}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}${row3}${c.gray}║${c.reset}`);
      console.log(`${c.gray}║${c.reset}${row4}${c.gray}║${c.reset}`);
      console.log(`${c.gray}╚${"═".repeat(boxW)}╝${c.reset}`);
      console.log("");
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

  // ── WELCOME BOX ────────────────═══════════════════════
  const boxW = 102;
  const line1 = padDisplayEnd(`  ${c.bold}${c.brightYellow}🚀 WELCOME TO VEXORA SERVER ENGINE CLI${c.reset} ${c.dim}(v${version})${c.reset}`, boxW);
  const line2 = padDisplayEnd(`  ${c.green}⚡ Blazing-Fast, Zero-Dependency Backend Framework for Node.js${c.reset}`, boxW);
  const line3 = padDisplayEnd(`  ${c.cyan}👤 Author:${c.reset} Satyam Kumar  ${c.dim}|${c.reset}  ${c.cyan}📞${c.reset} +91 9725399936  ${c.dim}|${c.reset}  ${c.magenta}🌐${c.reset} ${hyperLink}`, boxW);

  console.log(`${c.gray}╔${"═".repeat(boxW)}╗${c.reset}`);
  console.log(`${c.gray}║${c.reset}${line1}${c.gray}║${c.reset}`);
  console.log(`${c.gray}║${c.reset}${line2}${c.gray}║${c.reset}`);
  console.log(`${c.gray}║${c.reset}${line3}${c.gray}║${c.reset}`);
  console.log(`${c.gray}╚${"═".repeat(boxW)}╝${c.reset}`);

  if (interactive) {
    const answer = await promptQuestion("View all CLI Helper Commands & Options? (y/n)", "n");
    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log(`\n  ${c.brightYellow}💡${c.reset} Type ${c.green}vexora list${c.reset} or ${c.green}vexora help${c.reset} to view all commands.\n`);
      return;
    }
  }

  // ── BUILD DEDUPLICATED COMMAND LIST ───────────────────
  const aliasToParent = new Map();
  for (const [name, cmd] of Object.entries(allCommands)) {
    if (cmd.aliases) {
      for (const a of cmd.aliases) aliasToParent.set(a, name);
    }
  }

  const categories = {};
  const flatList = [];
  const seenNames = new Set();

  for (const [name, cmd] of Object.entries(allCommands)) {
    if (name === "list") continue;
    if (aliasToParent.has(name) && aliasToParent.get(name) !== name) continue;
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const rawCat = cmd.category || "Other";
    const cat = rawCat.replace(/\uFE0E|\uFE0F/g, "").trim();
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ name, ...cmd });
  }

  // ── RENDER TABLE ──────────────────────────────────────
  const col0 = 5;  // Serial number column width
  const col1 = 44; // Command column width
  const col2 = 56; // Description column width
  const totalW = col0 + col1 + col2 + 5;

  console.log("");
  console.log(`  ${c.bold}${c.brightCyan}📋 VEXORA CLI — COMPLETE COMMANDS REFERENCE${c.reset}`);
  console.log(`  ${c.dim}Type a serial number to run a command interactively${c.reset}`);
  console.log("");

  // Top border
  console.log(`  ${c.gray}╔${"═".repeat(col0 + 1)}╦${"═".repeat(col1 + 1)}╦${"═".repeat(col2 + 1)}╗${c.reset}`);
  // Header row
  const head0 = padDisplayEnd("#", col0);
  const head1 = padDisplayEnd("COMMAND", col1);
  const head2 = padDisplayEnd("DESCRIPTION", col2);
  console.log(`  ${c.gray}║${c.reset} ${c.bold}${c.brightCyan}${head0}${c.reset} ${c.gray}║${c.reset} ${c.bold}${c.brightCyan}${head1}${c.reset} ${c.gray}║${c.reset} ${c.bold}${c.brightCyan}${head2}${c.reset} ${c.gray}║${c.reset}`);

  let serialNum = 0;

  for (const [category, cmds] of Object.entries(categories)) {
    // Category separator
    console.log(`  ${c.gray}╠${"═".repeat(col0 + 1)}╬${"═".repeat(col1 + 1)}╬${"═".repeat(col2 + 1)}╣${c.reset}`);
    const catPadded = padDisplayEnd(` ${category}`, col1);
    const emptyCol0 = " ".repeat(col0);
    const emptyCol2 = " ".repeat(col2);
    console.log(`  ${c.gray}║${c.reset} ${emptyCol0} ${c.gray}║${c.reset} ${c.bold}${c.brightYellow}${catPadded}${c.reset} ${c.gray}║${c.reset} ${emptyCol2} ${c.gray}║${c.reset}`);
    console.log(`  ${c.gray}╠${"═".repeat(col0 + 1)}╬${"═".repeat(col1 + 1)}╬${"═".repeat(col2 + 1)}╣${c.reset}`);

    cmds.forEach((cmd, i) => {
      serialNum++;
      const usageStr = cmd.usage || cmd.name;
      const cmdStr = `vexora ${usageStr}`;
      
      const cmdPadded = padDisplayEnd(cmdStr, col1);
      const descPadded = padDisplayEnd(cmd.description, col2);
      const numStr = padDisplayEnd(String(serialNum), col0);

      // Store in flat list for interactive selection
      flatList.push({ serial: serialNum, name: cmd.name, usage: usageStr, cmd });

      console.log(`  ${c.gray}║${c.reset} ${c.brightYellow}${numStr}${c.reset} ${c.gray}║${c.reset} ${c.green}${cmdPadded}${c.reset} ${c.gray}║${c.reset} ${c.white}${descPadded}${c.reset} ${c.gray}║${c.reset}`);

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
      const choice = await promptQuestion(`Enter command name or # (1-${serialNum}) to run, or press Enter to exit`, "");
      if (!choice) break;

      let input = choice.trim();

      // Clean up leading 'npx vexora' or 'vexora' if typed
      input = input.replace(/^(npx\s+)?vexora\s+/i, "");
      const inputParts = input.split(/\s+/);
      const typedCmdName = inputParts[0];
      const typedExtraArgs = inputParts.slice(1);

      let selected = null;

      // 1. Check if user typed a number
      const num = parseInt(input);
      if (!isNaN(num) && String(num) === input && num >= 1 && num <= serialNum) {
        selected = flatList.find(f => f.serial === num);
      } else {
        // 2. Check if user typed command name or alias
        selected = flatList.find(f => f.name === typedCmdName || (f.cmd.aliases && f.cmd.aliases.includes(typedCmdName)));

        if (!selected && allCommands[typedCmdName]) {
          selected = { serial: 0, name: typedCmdName, usage: typedCmdName, cmd: allCommands[typedCmdName] };
        }
      }

      if (!selected) {
        console.log(`  ${c.brightYellow}❌ Invalid command or selection '${choice}'. Try again or press Enter to exit.${c.reset}\n`);
        continue;
      }

      // Extract required (<arg>) and optional ([arg]) arguments from usage (skip [options], [flags], etc.)
      const usageArgs = selected.usage
        ? [...selected.usage.matchAll(/[<\[]([^\]>]+)[>\]]/g)]
            .map(m => m[1])
            .filter(a => !["options", "flags", "..."].includes(a.toLowerCase()))
        : [];
      let finalArgs = [selected.name, ...typedExtraArgs];

      if (usageArgs.length > typedExtraArgs.length) {
        const remainingUsageArgs = usageArgs.slice(typedExtraArgs.length);
        for (const argName of remainingUsageArgs) {
          let defaultArgVal = "";
          if (["key", "dbkey", "[key]"].includes(argName.toLowerCase())) {
            try {
              const { readDbConfig } = await import("./helpers.js");
              const dbConfs = readDbConfig();
              defaultArgVal = Object.keys(dbConfs)[0] || "";
            } catch (e) {}
          }
          const argVal = await promptQuestion(
            `📝 Enter ${argName} (Usage: vexora ${selected.usage || selected.name})`,
            defaultArgVal
          );
          if (argVal) finalArgs.push(argVal);
        }
      }

      // Confirmation
      const cmdDisplay = `vexora ${finalArgs.join(" ")}`;
      const confirm = await promptQuestion(`Run "${cmdDisplay}"? (y/n)`, "y");
      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log(`  ${c.dim}⏹ Cancelled.${c.reset}\n`);
        continue;
      }

      console.log(`\n  ${c.brightCyan}▶ Running:${c.reset} ${c.green}${cmdDisplay}${c.reset}\n`);

      try {
        await selected.cmd.run(finalArgs, allCommands);
      } catch (err) {
        console.error(`  ${c.brightYellow}❌ Error:${c.reset} ${err.message}`);
      }

      console.log(`  ${c.dim}✅ Finished execution.${c.reset}`);
    }
  }
}
