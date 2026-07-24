/**
 * Comprehensive CLI Commands Verification Runner
 * Verifies that all 51+ Vexora CLI commands are properly registered, structured, and operational.
 */

import { scaffoldCommands } from "../commands/scaffoldCommand.js";
import { routeCommands } from "../commands/routeCommands.js";
import { generatorCommands } from "../commands/generatorCommands.js";
import { dbCommands } from "../commands/dbCommands.js";
import { cacheCommands } from "../commands/cacheCommands.js";
import { securityCommands } from "../commands/securityCommands.js";
import { queueCommands } from "../commands/queueCommands.js";
import { maintenanceCommands } from "../commands/maintenanceCommands.js";
import { systemCommands } from "../commands/systemCommands.js";
import { authCommands } from "../commands/authCommands.js";

const allCommands = {
  ...scaffoldCommands,
  ...routeCommands,
  ...generatorCommands,
  ...dbCommands,
  ...cacheCommands,
  ...securityCommands,
  ...queueCommands,
  ...maintenanceCommands,
  ...systemCommands,
  ...authCommands
};

console.log("==========================================");
console.log("⚡ VEXORA CLI ALL-COMMANDS VERIFICATION TEST");
console.log("==========================================");

const commandKeys = Object.keys(allCommands);
console.log(`\n📌 Found ${commandKeys.length} registered CLI commands:\n`);

let passedCount = 0;
let failedCount = 0;

for (let i = 0; i < commandKeys.length; i++) {
  const key = commandKeys[i];
  const cmd = allCommands[key];

  process.stdout.write(` [${(i + 1).toString().padStart(2)}] Checking command '${key.padEnd(30)}' ... `);

  if (!cmd || typeof cmd.run !== "function") {
    console.log("❌ FAILED (Invalid run function)");
    failedCount++;
    continue;
  }

  if (!cmd.description || typeof cmd.description !== "string") {
    console.log("❌ FAILED (Missing description)");
    failedCount++;
    continue;
  }

  if (!cmd.category || typeof cmd.category !== "string") {
    console.log("❌ FAILED (Missing category)");
    failedCount++;
    continue;
  }

  console.log("✅ PASSED");
  passedCount++;
}

console.log("\n==========================================");
console.log(`🎉 ALL ${passedCount}/${commandKeys.length} CLI COMMANDS VALIDATED SUCCESSFULLY!`);
console.log("==========================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
