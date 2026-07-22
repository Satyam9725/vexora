/**
 * Vexora Framework - Route Commands
 */

import fs from "node:fs";
import path from "node:path";
import { rootDir, apiRoutesDir, controllersDir, ensureDir, line } from "./helpers.js";

export const routeCommands = {
  "make:route": {
    description: "Creates a new API route folder with api.whitelist.js",
    usage: "make:route <name>",
    category: "📌 Routes",
    aliases: ["make:api"],
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a route name.");
        console.error("   Usage: node Vexora make:route <name>");
        process.exit(1);
      }
      const routeName = name.trim().replace(/^\/+|\/+$/g, "");
      console.log(`⚙️ Creating API Route inside .api_routes/${routeName}...`);

      ensureDir(apiRoutesDir());
      const targetDir = path.join(apiRoutesDir(), routeName);
      ensureDir(targetDir);

      const whitelistFile = path.join(targetDir, "api.whitelist.js");
      if (fs.existsSync(whitelistFile)) {
        console.warn(
          `⚠️ Warning: ${path.relative(rootDir(), whitelistFile)} already exists!`
        );
        process.exit(0);
      }

      const whitelistTemplate = `import Vexora from "vexora";

// Create a RouteController to act as a whitelist and router
const apiRouter = new Vexora.RouteController();

// Map HTTP methods to specific controller script files
// apiRouter.get('endpoint'); // → .api_routes/${routeName}/endpoint.js

// Catch-all routing handler for undefined API routes
apiRouter.any('/:any', (req, res) => {
    return res.json({ status: false, message: "Action not found!" }, 404);
});

export default apiRouter;
`;

      fs.writeFileSync(whitelistFile, whitelistTemplate, "utf8");
      console.log(
        `✅ Created ${path.relative(rootDir(), whitelistFile)} successfully!`
      );
    },
  },

  "remove:route": {
    description: "Removes an API route directory",
    usage: "remove:route <name>",
    category: "📌 Routes",
    aliases: ["remove:api"],
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a route name to remove.");
        console.error("   Usage: node Vexora remove:route <name>");
        process.exit(1);
      }
      const routeName = name.trim().replace(/^\/+|\/+$/g, "");
      const targetDir = path.join(apiRoutesDir(), routeName);

      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log(`✅ Removed .api_routes/${routeName} successfully!`);
      } else {
        console.warn(`⚠️ API route .api_routes/${routeName} does not exist.`);
      }
    },
  },

  "route:list": {
    description: "Lists all registered API routes & endpoints",
    category: "📌 Routes",
    aliases: ["routes:list"],
    async run() {
      line();
      console.log("📌 VEXORA REGISTERED ROUTES & ENDPOINTS");
      line();

      const aDir = apiRoutesDir();
      if (fs.existsSync(aDir)) {
        const scanDir = (dir, prefix = "/api") => {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              scanDir(path.join(dir, item.name), `${prefix}/${item.name}`);
            } else if (item.name === "api.whitelist.js") {
              console.log(
                `  [WHITELIST]  ${prefix}/  →  ${path.relative(rootDir(), path.join(dir, item.name))}`
              );
            } else if (item.name.endsWith(".js")) {
              const epName = item.name.replace(/\.js$/, "");
              console.log(
                `  [ENDPOINT]   ${prefix}/${epName}  →  ${path.relative(rootDir(), path.join(dir, item.name))}`
              );
            }
          }
        };
        scanDir(aDir);
      }

      const cDir = controllersDir();
      if (fs.existsSync(cDir)) {
        const items = fs.readdirSync(cDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isFile() && item.name.endsWith(".js")) {
            const epName = item.name.replace(/\.js$/, "");
            console.log(`  [CONTROLLER] /${epName}  →  controllers/${item.name}`);
          }
        }
      }
      line();
    },
  }
};
