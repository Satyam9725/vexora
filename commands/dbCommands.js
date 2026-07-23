/**
 * Vexora Framework - Database Commands & Complete Table Manager
 */

import {
  SUPPORTED_DB_DRIVERS,
  promptQuestion,
  readDbConfig,
  writeDbConfig,
  padDisplayEnd,
  renderConsoleTable,
  line
} from "./helpers.js";

function formatWhereClause(input, defaultId = 1) {
  let raw = (input || "").trim();
  if (!raw) return `id = ${defaultId}`;
  if (/^\d+$/.test(raw)) {
    return `id = ${raw}`;
  }
  return raw;
}

async function getDbClient(keyArg) {
  const configs = readDbConfig();
  const availableKeys = Object.keys(configs);

  if (availableKeys.length === 0) {
    console.error("❌ No databases configured in .vexora_config/db_config.json");
    console.log("💡 Tip: Use 'vexora db:add' to configure a database connection.");
    return null;
  }

  let key = availableKeys.find(k => k.toLowerCase() === (keyArg || "").toLowerCase());

  if (!key) {
    line();
    console.log("📌 Select Database Connection:");
    availableKeys.forEach((k, idx) => console.log(`   ${idx + 1}. [${k}] → ${configs[k].driver || configs[k].DB_DRIVER || "mysql"}://${configs[k].DB_USER}@${configs[k].DB_HOST}/${configs[k].DB_NAME}`));
    line();

    const selected = await promptQuestion("Enter Connection Key or # to use", availableKeys[0]);
    const num = parseInt(selected);
    if (!isNaN(num) && num >= 1 && num <= availableKeys.length) {
      key = availableKeys[num - 1];
    } else {
      key = availableKeys.find(k => k.toLowerCase() === selected.trim().toLowerCase()) || selected.trim();
    }
  }

  const conf = configs[key];
  if (!conf) {
    console.error(`❌ Error: Database connection '${key}' not found in db_config.json!`);
    console.log(`💡 Tip: Available keys: ${availableKeys.join(", ") || "None"}`);
    return null;
  }

  const driver = (conf.driver || conf.DB_DRIVER || "mysql").toLowerCase();
  const connObj = {
    host: conf.DB_HOST || "127.0.0.1",
    user: conf.DB_USER || "root",
    password: conf.DB_PASS || "",
    database: conf.DB_NAME || "",
    driver
  };

  try {
    const testDriver = driver === "postgres" ? (await import("../database/postgres.js")).default : (await import("../database/mysql.js")).default;
    const client = await testDriver.connect(connObj);
    return { client, driver, key, dbName: conf.DB_NAME };
  } catch (err) {
    console.error(`❌ Failed to connect to database '${key}': ${err.message}`);
    return null;
  }
}

async function renderTableDetailLoop(client, driver, key, tableName, tableList) {
  while (true) {
    line();
    console.log(`📋 SCHEMA FOR TABLE '${tableName}' [Connection: ${key}]:`);
    line();
    try {
      if (driver === "postgres") {
        const res = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`, [tableName]);
        res.rows.forEach(r => console.log(`  • ${r.column_name.padEnd(20)} : ${(r.data_type).padEnd(15)} (Nullable: ${r.is_nullable})`));
      } else {
        const [rows] = await client.query(`DESCRIBE \`${tableName}\``);
        rows.forEach(r => console.log(`  • ${String(r.Field).padEnd(20)} : ${String(r.Type).padEnd(15)} (Null: ${r.Null}, Key: ${r.Key || "-"})`));
      }
    } catch (err) {
      console.error(`❌ Error reading schema: ${err.message}`);
    }

    line();
    console.log(`📖 PREVIEW DATA FOR TABLE '${tableName}' (FIRST 20 ROWS):`);
    line();

    try {
      let dataRows = [];
      if (driver === "postgres") {
        const res = await client.query(`SELECT * FROM "${tableName}" LIMIT 20`);
        dataRows = res.rows;
      } else {
        const [r] = await client.query(`SELECT * FROM \`${tableName}\` LIMIT 20`);
        dataRows = r;
      }

      if (!dataRows || dataRows.length === 0) {
        console.log(`  (Table '${tableName}' is empty)`);
      } else {
        renderConsoleTable(dataRows);
      }
    } catch (err) {
      console.error(`❌ Error previewing data: ${err.message}`);
    }
    line();

    const actionChoice = await promptQuestion("Options: [u]pdate row | [i]nsert row | [d]elete row | [b]ack to tables list | Press Enter for main menu", "");
    const act = actionChoice.toLowerCase().trim();

    if (act === "b" || act === "back") {
      break;
    } else if (act === "u" || act === "update") {
      await dbCommands["db:table:update"].run(["db:table:update", tableName, key]);
    } else if (act === "i" || act === "insert") {
      await dbCommands["db:table:insert"].run(["db:table:insert", tableName, key]);
    } else if (act === "d" || act === "delete") {
      const rawWhere = await promptQuestion("Enter row ID or WHERE clause to DELETE (e.g. 1 or id = 1)", "");
      if (rawWhere) {
        const whereCond = formatWhereClause(rawWhere);
        const confirm = await promptQuestion(`⚠️ Confirm DELETE FROM '${tableName}' WHERE ${whereCond}? (y/n)`, "n");
        if (confirm.toLowerCase() === "y" || confirm.toLowerCase() === "yes") {
          try {
            const delQuery = driver === "postgres" ? `DELETE FROM "${tableName}" WHERE ${whereCond}` : `DELETE FROM \`${tableName}\` WHERE ${whereCond}`;
            await client.query(delQuery);
            console.log(`✅ Deleted record(s) from '${tableName}' successfully!`);
          } catch (e) {
            console.error(`❌ Error deleting record: ${e.message}`);
          }
        }
      }
    } else {
      break;
    }
  }
}

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
            return;
          }
        } else {
          console.log(`📌 Connection Key: ${dbKey}`);
        }

        const existingKey = Object.keys(dbConfigs).find(k => k.toLowerCase() === dbKey.toLowerCase());
        if (existingKey) {
          line();
          console.error(
            `❌ Error: Connection key '${existingKey}' already exists in db_config.json!`
          );
          console.error(
            `💡 Tip: Run 'vexora db:list' to see existing connections or 'vexora db:remove ${existingKey}' to remove it.`
          );
          line();
          return;
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
        const existingKey = Object.keys(dbConfigs).find(k => k.toLowerCase() === dbKey.toLowerCase());
        if (existingKey) {
          line();
          console.error(
            `❌ Error: Connection key '${existingKey}' already exists in db_config.json!`
          );
          console.error(
            `💡 Tip: Run 'vexora db:list' to see existing connections or 'vexora db:remove ${existingKey}' to remove it.`
          );
          line();
          return;
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
          return;
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
      const rawKey = args[1] ? args[1].trim() : "";
      const configs = readDbConfig();
      const keys = Object.keys(configs);

      let keyToRemove = rawKey;
      if (!keyToRemove) {
        if (keys.length === 0) {
          console.error("❌ No database connections found to remove.");
          return;
        }
        keyToRemove = await promptQuestion(`Enter Database Key to remove (Available: ${keys.join(", ")})`, keys[0]);
        if (!keyToRemove) return;
      }

      const matchingKey = keys.find(k => k.toLowerCase() === keyToRemove.toLowerCase()) || keyToRemove;

      if (configs[matchingKey]) {
        delete configs[matchingKey];
        writeDbConfig(configs);
        console.log(
          `✅ Removed database connection '${matchingKey}' from db_config.json!`
        );
      } else {
        console.warn(
          `⚠️ Warning: Connection key '${keyToRemove}' not found in db_config.json.`
        );
        if (keys.length > 0) {
          console.log(`💡 Available keys: ${keys.join(", ")}`);
        }
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
      let rawKey = args[1] ? args[1].trim() : "";
      const dbObj = await getDbClient(rawKey);
      if (dbObj) {
        line();
        console.log(`🟢 SUCCESS: Connection '${dbObj.key}' is ALIVE!`);
        line();
      }
    }
  },

  // ─── Table Management Commands ─────────────────────────
  "db:table:list": {
    description: "Lists all database tables and allows interactive viewing & editing",
    usage: "db:table:list [key]",
    category: "🗄️ Database",
    aliases: ["db:tables", "db:table-list"],
    async run(args) {
      const dbObj = await getDbClient(args[1]);
      if (!dbObj) return;

      const { client, driver, key, dbName } = dbObj;
      while (true) {
        line();
        console.log(`📊 DATABASE TABLES FOR '${key}' (${dbName}) [${driver.toUpperCase()}]`);
        line();

        try {
          let tables = [];
          if (driver === "postgres") {
            const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            tables = res.rows.map(r => r.table_name);
          } else {
            const [rows] = await client.query("SHOW TABLES");
            tables = rows.map(r => Object.values(r)[0]);
          }

          if (tables.length === 0) {
            console.log("  (No tables found in database)");
            line();
            return;
          }

          const tableList = [];
          for (let i = 0; i < tables.length; i++) {
            const tbl = tables[i];
            let count = "?";
            try {
              if (driver === "postgres") {
                const cRes = await client.query(`SELECT COUNT(*) AS total FROM "${tbl}"`);
                count = cRes.rows[0].total;
              } else {
                const [cRows] = await client.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
                count = cRows[0].total;
              }
            } catch (e) {}

            tableList.push({ serial: i + 1, name: tbl, count });
            console.log(`  ${i + 1}. 📄 ${tbl.padEnd(30)} (Rows: ${count})`);
          }
          line();

          const choice = await promptQuestion("View table data/schema? Enter table # or name (or press Enter for main menu)", "");
          if (!choice) break;

          let selectedTbl = null;
          const num = parseInt(choice);
          if (!isNaN(num) && String(num) === choice.trim() && num >= 1 && num <= tableList.length) {
            selectedTbl = tableList.find(t => t.serial === num).name;
          } else {
            selectedTbl = tableList.find(t => t.name.toLowerCase() === choice.trim().toLowerCase())?.name || choice.trim();
          }

          if (selectedTbl) {
            await renderTableDetailLoop(client, driver, key, selectedTbl, tableList);
          }
        } catch (err) {
          console.error(`❌ Error fetching tables: ${err.message}`);
          line();
          break;
        }
      }
    }
  },

  "db:table:view": {
    description: "Views schema & formatted ASCII grid data of a database table",
    usage: "db:table:view [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:view-table", "db:table-view"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter Table Name to view schema & data");
        if (!tableName) return;
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;
      await renderTableDetailLoop(client, driver, key, tableName, []);
    }
  },

  "db:table:update": {
    description: "Updates rows/records in a database table",
    usage: "db:table:update [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:update-table", "db:table-update"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter Table Name to UPDATE");
        if (!tableName) return;
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;

      line();
      console.log(`📝 UPDATE RECORD IN TABLE '${tableName}' [Connection: ${key}]`);
      line();

      const colName = await promptQuestion("Enter Column Name to update (e.g. user_id, status, title)");
      if (!colName) {
        console.error("❌ Column name is required!");
        return;
      }

      const newVal = await promptQuestion(`Enter New Value for '${colName}'`);
      const rawWhere = await promptQuestion("Enter row ID or WHERE clause (e.g. 1 or id = 1)", "1");
      const whereCond = formatWhereClause(rawWhere);

      try {
        const updateQuery = driver === "postgres"
          ? `UPDATE "${tableName}" SET "${colName}" = $1 WHERE ${whereCond}`
          : `UPDATE \`${tableName}\` SET \`${colName}\` = ? WHERE ${whereCond}`;

        if (driver === "postgres") {
          const res = await client.query(updateQuery, [newVal]);
          console.log(`✅ Updated record(s) in table '${tableName}' successfully! (Rows affected: ${res.rowCount || 1})`);
        } else {
          const [res] = await client.query(updateQuery, [newVal]);
          console.log(`✅ Updated record(s) in table '${tableName}' successfully! (Rows affected: ${res.affectedRows || 1})`);
        }
      } catch (err) {
        console.error(`❌ Failed to update table '${tableName}': ${err.message}`);
      }
      line();
    }
  },

  "db:table:insert": {
    description: "Inserts a new record/row into a database table",
    usage: "db:table:insert [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:insert-row", "db:table-insert"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter Table Name to INSERT record into");
        if (!tableName) return;
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;

      line();
      console.log(`➕ INSERT RECORD INTO TABLE '${tableName}' [Connection: ${key}]`);
      line();

      const columnsStr = await promptQuestion("Enter Column Names separated by comma (e.g. user_id, status)");
      if (!columnsStr) {
        console.error("❌ Column names are required!");
        return;
      }

      const cols = columnsStr.split(",").map(c => c.trim()).filter(Boolean);
      const valList = [];
      for (const col of cols) {
        const val = await promptQuestion(`Enter value for column '${col}'`);
        valList.push(val);
      }

      try {
        if (driver === "postgres") {
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
          const colSql = cols.map(c => `"${c}"`).join(", ");
          const query = `INSERT INTO "${tableName}" (${colSql}) VALUES (${placeholders})`;
          await client.query(query, valList);
        } else {
          const placeholders = cols.map(() => "?").join(", ");
          const colSql = cols.map(c => `\`${c}\``).join(", ");
          const query = `INSERT INTO \`${tableName}\` (${colSql}) VALUES (${placeholders})`;
          await client.query(query, valList);
        }

        console.log(`✅ Record inserted successfully into table '${tableName}'!`);
      } catch (err) {
        console.error(`❌ Failed to insert record: ${err.message}`);
      }
      line();
    }
  },

  "db:table:create": {
    description: "Interactively creates a new database table",
    usage: "db:table:create [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:create-table", "db:make-table"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter New Table Name (e.g. users, posts, products)");
        if (!tableName) {
          console.error("❌ Table name is required!");
          return;
        }
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;
      console.log(`\n⚙️ Creating table '${tableName}' on connection '${key}'...`);

      let columnsSQL = "";
      if (driver === "postgres") {
        columnsSQL = `id SERIAL PRIMARY KEY, title VARCHAR(255), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
      } else {
        columnsSQL = `id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), status VARCHAR(50) DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;
      }

      const customCols = await promptQuestion("Enter columns definition (or press ENTER for default id, title, status, timestamps)", columnsSQL);

      try {
        const createQuery = driver === "postgres"
          ? `CREATE TABLE IF NOT EXISTS "${tableName}" (${customCols})`
          : `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${customCols})`;

        if (driver === "postgres") {
          await client.query(createQuery);
        } else {
          await client.query(createQuery);
        }

        console.log(`✅ Table '${tableName}' created successfully in database connection '${key}'!`);
      } catch (err) {
        console.error(`❌ Failed to create table '${tableName}': ${err.message}`);
      }
    }
  },

  "db:table:drop": {
    description: "Drops (deletes) a database table",
    usage: "db:table:drop [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:table:delete", "db:drop-table"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter Table Name to DROP/DELETE");
        if (!tableName) {
          console.error("❌ Table name is required!");
          return;
        }
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;

      const confirm = await promptQuestion(`⚠️ WARNING: Drop table '${tableName}' from '${key}'? (y/n)`, "n");
      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log("⏹ Cancelled table drop.");
        return;
      }

      try {
        const dropQuery = driver === "postgres"
          ? `DROP TABLE IF EXISTS "${tableName}" CASCADE`
          : `DROP TABLE IF EXISTS \`${tableName}\``;

        await client.query(dropQuery);
        console.log(`✅ Table '${tableName}' dropped successfully from connection '${key}'!`);
      } catch (err) {
        console.error(`❌ Failed to drop table '${tableName}': ${err.message}`);
      }
    }
  },

  "db:table:truncate": {
    description: "Truncates (empties) all data from a database table",
    usage: "db:table:truncate [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:truncate-table", "db:clear-table"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter Table Name to TRUNCATE/CLEAR");
        if (!tableName) return;
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;
      const confirm = await promptQuestion(`⚠️ TRUNCATE all rows in table '${tableName}' on '${key}'? (y/n)`, "n");
      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log("⏹ Cancelled.");
        return;
      }

      try {
        const truncQuery = driver === "postgres"
          ? `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`
          : `TRUNCATE TABLE \`${tableName}\``;

        await client.query(truncQuery);
        console.log(`✅ Table '${tableName}' truncated successfully on '${key}'!`);
      } catch (err) {
        console.error(`❌ Failed to truncate table '${tableName}': ${err.message}`);
      }
    }
  },

  "db:table:describe": {
    description: "Displays structure/schema of a database table",
    usage: "db:table:describe [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:table:info", "db:describe"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter Table Name to inspect");
        if (!tableName) {
          console.error("❌ Table name is required!");
          return;
        }
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;
      line();
      console.log(`📋 TABLE SCHEMA: '${tableName}' [Connection: ${key}]`);
      line();

      try {
        if (driver === "postgres") {
          const res = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1`, [tableName]);
          if (res.rows.length === 0) {
            console.log(`  (Table '${tableName}' not found)`);
          } else {
            res.rows.forEach(r => {
              console.log(`  • ${r.column_name.padEnd(20)} : ${(r.data_type).padEnd(15)} (Nullable: ${r.is_nullable})`);
            });
          }
        } else {
          const [rows] = await client.query(`DESCRIBE \`${tableName}\``);
          rows.forEach(r => {
            console.log(`  • ${String(r.Field).padEnd(20)} : ${String(r.Type).padEnd(15)} (Null: ${r.Null}, Key: ${r.Key || "-"})`);
          });
        }
      } catch (err) {
        console.error(`❌ Error describing table '${tableName}': ${err.message}`);
      }
      line();
    }
  },

  "db:query": {
    description: "Executes a raw SQL query on database connection",
    usage: "db:query [sql] [key]",
    category: "🗄️ Database",
    aliases: ["db:sql", "db:run"],
    async run(args) {
      let sql = args[1] ? args.slice(1).join(" ") : "";
      let keyArg = "";

      if (!sql) {
        sql = await promptQuestion("Enter SQL Query (e.g. SELECT * FROM users LIMIT 10)");
        if (!sql) {
          console.error("❌ SQL Query is required!");
          return;
        }
      }

      const dbObj = await getDbClient(keyArg);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;
      console.log(`\n⚡ Executing SQL on '${key}'...`);

      try {
        const startTime = performance.now();
        let results = null;
        if (driver === "postgres") {
          const res = await client.query(sql);
          results = res.rows || res;
        } else {
          const [rows] = await client.query(sql);
          results = rows;
        }
        const duration = (performance.now() - startTime).toFixed(2);

        line();
        console.log(`🟢 QUERY EXECUTED (${duration}ms)`);
        line();
        if (Array.isArray(results) && results.length > 0) {
          renderConsoleTable(results);
        } else {
          console.dir(results, { depth: null, colors: true });
        }
        line();
      } catch (err) {
        console.error(`❌ SQL Query Error: ${err.message}`);
      }
    }
  }
};
