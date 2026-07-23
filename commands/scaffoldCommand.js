/**
 * Vexora Framework - Scaffolding Commands
 */

import fs from "node:fs";
import path from "node:path";
import { rootDir, controllersDir, ensureDir } from "./helpers.js";

export const scaffoldCommands = {
  "init": {
    description: "Scaffolds a new Vexora project",
    category: "🏗️ Scaffolding",
    async run(args) {
      const Init = (await import("../utils/init.js")).default;
      console.log("⚙️ Scaffolding Vexora Project...");
      try {
        Init.setup();

        console.log("✅ Vexora project structure successfully initialized!");
        console.log("👉 Configuration saved in .vexora_config/config");
      } catch (err) {
        console.error("❌ Failed to scaffold project:", err.message);
      }
    },
  }
};
