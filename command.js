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

  if (!command) {
    await renderHelpUI(commands, true);
    process.exit(0);
  }

  // Check direct match
  if (commands[command]) {
    await commands[command].run(args);
    process.exit(0);
  }

  // Check aliases
  for (const [name, cmd] of Object.entries(commands)) {
    if (cmd.aliases && cmd.aliases.includes(command)) {
      await cmd.run(args);
      process.exit(0);
    }
  }

  // Unknown command
  console.error(`❌ Unknown command: '${command}'`);
  console.error("💡 Run 'node Vexora' to see all available commands.\n");
  await renderHelpUI(commands, false);
  process.exit(1);
}
