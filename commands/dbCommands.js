/**
 * Vexora Framework - Database Commands
 */

import {
  SUPPORTED_DB_DRIVERS,
  promptQuestion,
  readDbConfig,
  writeDbConfig,
  line
} from "./helpers.js";

export const dbCommands = {
  "db:add": {
    description: "Add a new database connection (Interactive Wizard)",
    usage: "db:add [key] [options]",
    category: "🗄️ Database",
    aliases: ["make:database"],
    async run(args) {
      const dbConfigs = readDbConfig();

      let dbKey = args[1] ? args[1].trim() : "";
      let host = "127.0.0.1";
      let dbName = "";
      let user = "root";
      let pass = "";
      let driver = "mysql";

      const hasInlineArgs =
        args.length > 2 || (args[1] && args[1].includes("="));

      if (!hasInlineArgs) {
        line();
        console.log("🛠️ VEXORA DATABASE CONFIGURATION WIZARD");
        line();

        if (!dbKey) {
          dbKey = await promptQuestion(
            "1/6 Enter Connection Key/Name (e.g. auth, User, admin)"
          );
          if (!dbKey) {
            console.error("❌ Connection Key is required!");
            process.exit(1);
          }
        } else {
          console.log(`📌 Connection Key: ${dbKey}`);
        }

        if (dbConfigs[dbKey]) {
          line();
          console.error(
            `❌ Error: Connection key '${dbKey}' already exists in db_config.json!`
          );
          console.error(
            `💡 Tip: Run 'node Vexora db:list' to see existing connections or 'node Vexora db:remove ${dbKey}' to remove it.`
          );
          line();
          process.exit(1);
        }

        while (true) {
          driver = await promptQuestion(
            "2/6 Enter Database Driver (mysql/postgres)",
            "mysql"
          );
          if (SUPPORTED_DB_DRIVERS.includes(driver.toLowerCase())) {
            driver = driver.toLowerCase();
            break;
          }
          console.error(
            `❌ Invalid driver '${driver}'. Supported drivers: ${SUPPORTED_DB_DRIVERS.join(", ")}`
          );
        }

        host = await promptQuestion(
          "3/6 Enter Database Host (IP / domain)",
          "127.0.0.1"
        );
        dbName = await promptQuestion("4/6 Enter Database Name", dbKey);
        user = await promptQuestion("5/6 Enter Database User", "root");
        pass = await promptQuestion("6/6 Enter Database Password", "");
      } else {
        if (dbConfigs[dbKey]) {
          line();
          console.error(
            `❌ Error: Connection key '${dbKey}' already exists in db_config.json!`
          );
          console.error(
            `💡 Tip: Run 'node Vexora db:list' to see existing connections or 'node Vexora db:remove ${dbKey}' to remove it.`
          );
          line();
          process.exit(1);
        }
        dbName = dbKey;
        for (let i = 2; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith("--host=")) host = arg.split("=")[1];
          else if (arg.startsWith("--name=")) dbName = arg.split("=")[1];
          else if (arg.startsWith("--user=")) user = arg.split("=")[1];
          else if (arg.startsWith("--pass=")) pass = arg.split("=")[1];
          else if (arg.startsWith("--driver=")) driver = arg.split("=")[1];
          else if (i === 2 && !arg.startsWith("--")) host = arg;
          else if (i === 3 && !arg.startsWith("--")) dbName = arg;
          else if (i === 4 && !arg.startsWith("--")) user = arg;
          else if (i === 5 && !arg.startsWith("--")) pass = arg;
          else if (i === 6 && !arg.startsWith("--")) driver = arg;
        }

        if (!SUPPORTED_DB_DRIVERS.includes(driver.toLowerCase())) {
          console.error(
            `❌ Invalid driver '${driver}'. Supported drivers: ${SUPPORTED_DB_DRIVERS.join(", ")}`
          );
          process.exit(1);
        }
        driver = driver.toLowerCase();
      }

      dbConfigs[dbKey] = {
        DB_HOST: host,
        DB_NAME: dbName,
        DB_USER: user,
        DB_PASS: pass,
        MSG: dbKey,
        DB_DRIVER: driver,
        driver: driver,
      };

      writeDbConfig(dbConfigs);
      line();
      console.log(
        `✅ Connection '${dbKey}' added successfully to .vexora_config/db_config.json!`
      );
      line();
    },
  },

  "db:list": {
    description: "Lists all configured database connections",
    category: "🗄️ Database",
    async run() {
      line();
      console.log("🗄️ VEXORA CONFIGURED DATABASES (db_config.json)");
      line();

      const configs = readDbConfig();
      const keys = Object.keys(configs);
      if (keys.length === 0) {
        console.log("  (No databases configured)");
      } else {
        keys.forEach((key, idx) => {
          const conf = configs[key];
          console.log(
            `  ${idx + 1}. [KEY: ${key}]  →  ${conf.driver || conf.DB_DRIVER}://${conf.DB_USER}@${conf.DB_HOST}/${conf.DB_NAME}`
          );
        });
      }
      line();
    },
  },

  "db:remove": {
    description: "Removes a database connection from db_config.json",
    usage: "db:remove <key>",
    category: "🗄️ Database",
    aliases: ["db:delete"],
    async run(args) {
      if (!args[1]) {
        console.error("❌ Please specify the database connection key to remove.");
        console.error("   Usage: node Vexora db:remove <key>");
        process.exit(1);
      }
      const keyToRemove = args[1].trim();
      const configs = readDbConfig();

      if (configs[keyToRemove]) {
        delete configs[keyToRemove];
        writeDbConfig(configs);
        console.log(
          `✅ Removed database connection '${keyToRemove}' from db_config.json!`
        );
      } else {
        console.warn(
          `⚠️ Warning: Key '${keyToRemove}' not found in db_config.json`
        );
      }
    },
  },

  "db:status": {
    description: "Checks database connection health",
    category: "🗄️ Database",
    async run() {
      line();
      console.log("🗄️ VEXORA DATABASE HEALTH CHECK");
      line();
      const configs = readDbConfig();
      const keys = Object.keys(configs);
      if (keys.length === 0) {
        console.log("  (No databases configured)");
      } else {
        keys.forEach((key) => {
          const conf = configs[key];
          console.log(
            `  [${key}]  →  ${conf.driver || conf.DB_DRIVER}://${conf.DB_USER}@${conf.DB_HOST}/${conf.DB_NAME}  ✅ Configured`
          );
        });
      }
      line();
    },
  },

  "db:con": {
    description: "Test database connection & interactively update credentials if failed",
    usage: "db:con [key]",
    category: "🗄️ Database",
    aliases: ["db:connect", "db:check"],
    async run(args) {
      let key = args[1] ? args[1].trim() : "";
      const configs = readDbConfig();
      const availableKeys = Object.keys(configs);

      if (!key) {
        if (availableKeys.length === 0) {
          console.error("❌ No databases configured in .vexora_config/db_config.json");
          console.log("💡 Tip: Use 'node Vexora db:add' to configure a database.");
          process.exit(1);
        }
        if (availableKeys.length === 1) {
          key = availableKeys[0];
        } else {
          line();
          console.log("📌 Available Database Connections:");
          availableKeys.forEach((k, idx) => console.log(`   ${idx + 1}. ${k}`));
          line();
          key = await promptQuestion("Enter Database Connection Key to test", availableKeys[0]);
        }
      }

      if (!configs[key]) {
        console.error(`❌ Error: Database connection '${key}' not found in db_config.json!`);
        console.log(`💡 Tip: Available keys: ${availableKeys.join(", ") || "None"}`);
        process.exit(1);
      }

      const testConnection = async (conf) => {
        line();
        console.log(`🔌 Testing Database Connection '${key}'...`);
        const driver = (conf.driver || conf.DB_DRIVER || "mysql").toLowerCase();
        const host = conf.DB_HOST || "127.0.0.1";
        const dbName = conf.DB_NAME || "";
        const user = conf.DB_USER || "root";
        const pass = conf.DB_PASS || "";

        console.log(`   • Driver   : ${driver}`);
        console.log(`   • Host     : ${host}`);
        console.log(`   • Database : ${dbName}`);
        console.log(`   • User     : ${user}`);
        console.log(`   • Password : ${pass ? "*****" : "(empty)"}`);

        const startTime = performance.now();
        try {
          const connObj = {
            host,
            user,
            password: pass,
            database: dbName,
            driver
          };
          const testDriver = driver === "postgres" ? (await import("../database/postgres.js")).default : (await import("../database/mysql.js")).default;
          const client = await testDriver.connect(connObj);
          await client.query("SELECT 1 AS alive");
          const duration = (performance.now() - startTime).toFixed(2);
          line();
          console.log(`🟢 SUCCESS: Connection '${key}' is ALIVE! (Ping: ${duration}ms)`);
          line();
          return { success: true };
        } catch (err) {
          const duration = (performance.now() - startTime).toFixed(2);
          line();
          console.error(`🔴 FAILED: Connection '${key}' FAILED! (${duration}ms)`);
          console.error(`❌ Reason: ${err.message}`);
          line();
          return { success: false, error: err.message };
        }
      };

      let conf = configs[key];
      let result = await testConnection(conf);

      if (!result.success) {
        console.log("\n⚠️ Connection failed. Would you like to fix the credentials right now?");
        const fixNow = await promptQuestion(`Update credentials for '${key}'? (y/n)`, "y");

        if (fixNow.toLowerCase() === "y" || fixNow.toLowerCase() === "yes") {
          line();
          console.log(`🛠️ UPDATE DATABASE CREDENTIALS FOR '${key}'`);
          console.log("  (Press ENTER to keep the current value shown in brackets)");
          line();

          const currentDriver = conf.driver || conf.DB_DRIVER || "mysql";
          let newDriver = await promptQuestion("Database Driver (mysql/postgres)", currentDriver);
          while (!SUPPORTED_DB_DRIVERS.includes(newDriver.toLowerCase())) {
            console.error(`❌ Invalid driver '${newDriver}'. Supported: ${SUPPORTED_DB_DRIVERS.join(", ")}`);
            newDriver = await promptQuestion("Database Driver (mysql/postgres)", currentDriver);
          }

          const newHost = await promptQuestion("Database Host", conf.DB_HOST || "127.0.0.1");
          const newDbName = await promptQuestion("Database Name", conf.DB_NAME || key);
          const newUser = await promptQuestion("Database User", conf.DB_USER || "root");
          const newPass = await promptQuestion("Database Password", conf.DB_PASS || "");

          configs[key] = {
            ...conf,
            "DB_HOST": newHost,
            "DB_NAME": newDbName,
            "DB_USER": newUser,
            "DB_PASS": newPass,
            "DB_DRIVER": newDriver.toLowerCase(),
            "driver": newDriver.toLowerCase()
          };

          writeDbConfig(configs);
          console.log(`\n✅ Updated '${key}' credentials in .vexora_config/db_config.json!`);

          console.log("🔄 Re-testing connection with updated credentials...");
          await testConnection(configs[key]);
        }
      }
    }
  }
};
