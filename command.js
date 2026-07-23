/**
 * ==========================================================
 * Vexora Framework - CLI Command Handler & Router
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

import { scaffoldCommands } from "./commands/scaffoldCommand.js";
import { routeCommands } from "./commands/routeCommands.js";
import { generatorCommands } from "./commands/generatorCommands.js";
import { dbCommands } from "./commands/dbCommands.js";
import { cacheCommands } from "./commands/cacheCommands.js";
import { securityCommands } from "./commands/securityCommands.js";
import { queueCommands } from "./commands/queueCommands.js";
import { maintenanceCommands } from "./commands/maintenanceCommands.js";
import { systemCommands, renderHelpUI } from "./commands/systemCommands.js";
import { authCommands, isAuthenticated, clearAuthSession } from "./commands/authCommands.js";
import { colors } from "./commands/helpers.js";

// Handle Ctrl+C (SIGINT) to automatically logout session
process.on("SIGINT", () => {
  clearAuthSession();
  console.log(`\n${colors.brightYellow}⚠️ Ctrl+C detected. Session terminated and logged out.${colors.reset}\n`);
  process.exit(0);
});

process.on("SIGTERM", () => {
  clearAuthSession();
  process.exit(0);
});

// Combine all modular command objects
const commands = {
  ...scaffoldCommands,
  ...routeCommands,
  ...generatorCommands,
  ...dbCommands,
  ...cacheCommands,
  ...securityCommands,
  ...queueCommands,
  ...maintenanceCommands,
  ...systemCommands,
  ...authCommands,
};

commands["list"] = {
  description: "Displays full list of CLI commands",
  category: "ℹ️ System",
  aliases: ["help", "--help", "-h"],
  async run() {
    await renderHelpUI(commands, false);
  }
};

// ==========================================================
// MAIN EXECUTOR
// ==========================================================

export default async function executeCommand(args) {
  const command = args[0];

  // Strictly enforce login: ONLY 'login' command allowed when unauthenticated
  if (!isAuthenticated()) {
    const isLoginCmd = command === "login" || command === "auth:login";
    if (!isLoginCmd) {
      console.log(`\n${colors.brightYellow}🔒 Access Denied! Authentication Required.${colors.reset}`);
      console.log(`👉 Please run '${colors.brightGreen}vexora login${colors.reset}' first to unlock and use Vexora CLI.\n`);
      process.exit(1);
    }
  }

  // If no subcommand passed (e.g. just 'vexora')
  if (!command) {
    await renderHelpUI(commands, true);
    process.exit(0);
  }

  // Find matching command by key or alias
  let targetCmdKey = null;
  if (commands[command]) {
    targetCmdKey = command;
  } else {
    for (const [name, cmd] of Object.entries(commands)) {
      if (cmd.aliases && cmd.aliases.includes(command)) {
        targetCmdKey = name;
        break;
      }
    }
  }

  // Unknown / Invalid command check
  if (!targetCmdKey) {
    console.log(`\n${colors.brightYellow}❌ Invalid command: '${command}'${colors.reset}`);
    console.log(`💡 Type '${colors.brightGreen}vexora list${colors.reset}' to view all available commands.\n`);
    process.exit(1);
  }

  // Execute matched command
  await commands[targetCmdKey].run(args, commands);
  process.exit(0);
}
