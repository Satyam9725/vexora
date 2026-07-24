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
  startSpinner,
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

  let requestedKey = keyArg;

  while (true) {
    let key = availableKeys.find(k => k.toLowerCase() === (requestedKey || "").toLowerCase());

    if (!key) {
      if (availableKeys.length === 1) {
        key = availableKeys[0];
      } else {
        line();
        console.log("📌 Select Database Connection:");
        availableKeys.forEach((k, idx) => console.log(`   ${idx + 1}. [${k}] → ${configs[k].driver || configs[k].DB_DRIVER || "mysql"}://${configs[k].DB_USER}@${configs[k].DB_HOST}/${configs[k].DB_NAME}`));
        line();

        const selected = await promptQuestion("Enter Connection Key or # to use (or type 'back' to exit)", availableKeys[0]);
        const trimmed = selected.trim();
        if (["back", "cancel", "exit", "b"].includes(trimmed.toLowerCase())) {
          return null;
        }
        const num = parseInt(trimmed);
        if (!isNaN(num) && num >= 1 && num <= availableKeys.length) {
          key = availableKeys[num - 1];
        } else {
          key = availableKeys.find(k => k.toLowerCase() === trimmed.toLowerCase()) || trimmed;
        }
      }
    }

    const conf = configs[key];
    if (!conf) {
      console.error(`❌ Error: Database connection '${key}' not found in db_config.json!`);
      console.log(`💡 Tip: Available keys: ${availableKeys.join(", ") || "None"}`);
      requestedKey = null;
      continue;
    }

    const driver = (conf.driver || conf.DB_DRIVER || "mysql").toLowerCase();
    const connObj = {
      host: conf.DB_HOST || "127.0.0.1",
      user: conf.DB_USER || "root",
      password: conf.DB_PASS || "",
      database: conf.DB_NAME || "",
      driver,
      url: conf.url || conf.DB_URL || conf.uri || null,
    };

    const spinner = startSpinner(`Connecting to database '${key}' (${driver})...`);
    try {
      let testDriver;
      if (driver === "postgres") {
        testDriver = (await import("../database/postgres.js")).default;
      } else if (driver === "mongodb") {
        testDriver = (await import("../database/mongodb.js")).default;
      } else {
        testDriver = (await import("../database/mysql.js")).default;
      }
      const client = await testDriver.connect(connObj);
      spinner.stop(true, `Connected to '${key}' (${conf.DB_NAME || "default"})!`);
      return { client, driver, key, dbName: conf.DB_NAME };
    } catch (err) {
      spinner.stop(false, `Failed to connect to database '${key}': ${err.message}`);
      if (availableKeys.length <= 1) {
        return null;
      }
      console.log("👉 Please select another database or try again.");
      requestedKey = null;
    }
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
      } else if (driver === "mongodb") {
        const doc = await client.collection(tableName).findOne();
        if (doc) {
          Object.keys(doc).forEach(k => {
            const val = doc[k];
            const type = val === null ? "null" : typeof val;
            console.log(`  • ${k.padEnd(20)} : ${type.padEnd(15)}`);
          });
        } else {
          console.log("  (Collection is empty - no schema columns detected)");
        }
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
      } else if (driver === "mongodb") {
        dataRows = await client.collection(tableName).find().limit(20).toArray();
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
            if (driver === "mongodb") {
              const { ObjectId } = await import("mongodb");
              let queryObj = {};
              if (/^[0-9a-fA-F]{24}$/.test(rawWhere.trim())) {
                queryObj = { _id: new ObjectId(rawWhere.trim()) };
              } else {
                const clean = rawWhere.trim();
                const match = clean.match(/^id\s*=\s*(.+)$/i) || clean.match(/^_id\s*=\s*(.+)$/i);
                if (match) {
                  const val = match[1].replace(/['"`]/g, "").trim();
                  if (/^[0-9a-fA-F]{24}$/.test(val)) {
                    queryObj = { _id: new ObjectId(val) };
                  } else {
                    const num = parseInt(val, 10);
                    queryObj = { _id: isNaN(num) ? val : num };
                  }
                } else {
                  const parts = clean.split("=");
                  if (parts.length === 2) {
                    const k = parts[0].trim();
                    const v = parts[1].replace(/['"`]/g, "").trim();
                    const num = parseInt(v, 10);
                    queryObj = { [k]: isNaN(num) ? v : num };
                  }
                }
              }
              await client.collection(tableName).deleteMany(queryObj);
              console.log(`✅ Deleted record(s) from '${tableName}' successfully!`);
            } else {
              const delQuery = driver === "postgres" ? `DELETE FROM "${tableName}" WHERE ${whereCond}` : `DELETE FROM \`${tableName}\` WHERE ${whereCond}`;
              await client.query(delQuery);
              console.log(`✅ Deleted record(s) from '${tableName}' successfully!`);
            }
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

import https from "node:https";

function resolveDnsOverHttps(name, type) {
  return new Promise((resolve) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => {
      resolve(null);
    });
  });
}

async function convertSrvToStandardUri(srvUri) {
  if (!srvUri.startsWith("mongodb+srv://")) {
    return srvUri;
  }

  try {
    const schemaIdx = srvUri.indexOf("://");
    const rest = srvUri.substring(schemaIdx + 3);
    
    let creds = "";
    let hostAndPath = rest;
    
    if (rest.includes("@")) {
      const lastAtIdx = rest.lastIndexOf("@");
      creds = rest.substring(0, lastAtIdx);
      hostAndPath = rest.substring(lastAtIdx + 1);
    }
    
    const pathParts = hostAndPath.split("/");
    const rootHostWithQuery = pathParts[0];
    const pathAndQuery = pathParts.slice(1).join("/");
    
    const rootHost = rootHostWithQuery.split("?")[0];
    
    const srvName = `_mongodb._tcp.${rootHost}`;
    const [srvRes, txtRes] = await Promise.all([
      resolveDnsOverHttps(srvName, "SRV"),
      resolveDnsOverHttps(rootHost, "TXT")
    ]);
    
    if (!srvRes || !srvRes.Answer || srvRes.Answer.length === 0) {
      return srvUri;
    }
    
    const shards = srvRes.Answer.map(ans => {
      const parts = ans.data.trim().split(/\s+/);
      const port = parts[2];
      let target = parts[3];
      if (target.endsWith(".")) {
        target = target.slice(0, -1);
      }
      return `${target}:${port}`;
    });
    
    let txtQuery = "";
    if (txtRes && txtRes.Answer && txtRes.Answer.length > 0) {
      const txtRecord = txtRes.Answer.find(ans => ans.data.includes("replicaSet"));
      if (txtRecord) {
        txtQuery = txtRecord.data.replace(/["']/g, "");
      }
    }
    
    let newUrl = "mongodb://";
    if (creds) {
      newUrl += creds + "@";
    }
    newUrl += shards.join(",");
    
    const existingParamsStart = pathAndQuery.indexOf("?");
    let dbPath = existingParamsStart !== -1 ? pathAndQuery.substring(0, existingParamsStart) : pathAndQuery;
    let existingQuery = existingParamsStart !== -1 ? pathAndQuery.substring(existingParamsStart + 1) : "";
    
    dbPath = dbPath.replace(/^\/+|\/+$/g, "");
    
    let finalQueryString = "";
    const queryParts = [];
    if (txtQuery) {
      queryParts.push(txtQuery);
    }
    if (existingQuery) {
      queryParts.push(existingQuery);
    }
    
    if (!txtQuery.includes("ssl=") && !existingQuery.includes("ssl=")) {
      queryParts.push("ssl=true");
    }
    
    finalQueryString = queryParts.join("&");
    
    newUrl += `/${dbPath}`;
    if (finalQueryString) {
      newUrl += `?${finalQueryString}`;
    }
    
    return newUrl;
  } catch (err) {
    return srvUri;
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
      let mongoUri = "";

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
            "2/6 Enter Database Driver (mysql/postgres/mongodb)",
            "mysql"
          );
          if (SUPPORTED_DB_DRIVERS.includes(driver.toLowerCase())) {
            driver = driver.toLowerCase();
            if (driver === "mongo") driver = "mongodb";
            break;
          }
          console.error(
            `❌ Invalid driver '${driver}'. Supported drivers: ${SUPPORTED_DB_DRIVERS.join(", ")}`
          );
        }

        if (driver === "mongodb") {
          let retryMongo = true;
          while (retryMongo) {
            line();
            console.log("📌 Select MongoDB Setup Option:");
            console.log("   1. Full Connection URI (e.g. " + "mongodb" + "+srv://<username>:<password>@cluster.mongodb.net/dbname)");
            console.log("   2. Individual Credentials (Host, User, Password, DB Name)");
            line();
            const mongoOpt = await promptQuestion("Select Option (1/2)", "1");

            try {
              if (mongoOpt.trim() === "1") {
                let rawUrl = await promptQuestion("Enter MongoDB Connection URI");
                if (!rawUrl.startsWith("mongodb" + "://") && !rawUrl.startsWith("mongodb" + "+srv://")) {
                  rawUrl = "mongodb" + "+srv://" + rawUrl;
                }

                if (rawUrl.startsWith("mongodb" + "+srv://")) {
                  console.log("🔍 Resolving MongoDB SRV & TXT records via DNS over HTTPS to bypass local connection errors...");
                  rawUrl = await convertSrvToStandardUri(rawUrl);
                }

                // Robust multi-@ URI Parser & Password Auto-Encoder
                const schemaIdx = rawUrl.indexOf("://");
                const schema = rawUrl.substring(0, schemaIdx);
                const rest = rawUrl.substring(schemaIdx + 3);

                if (rest.includes("@")) {
                  const lastAtIdx = rest.lastIndexOf("@");
                  const creds = rest.substring(0, lastAtIdx);
                  const hostAndPath = rest.substring(lastAtIdx + 1);

                  const firstColon = creds.indexOf(":");
                  if (firstColon !== -1) {
                    user = creds.substring(0, firstColon);
                    pass = creds.substring(firstColon + 1);
                    const encPass = encodeURIComponent(pass);
                    mongoUri = `${schema}://${user}:${encPass}@${hostAndPath}`;
                  } else {
                    mongoUri = rawUrl;
                  }

                  const pathParts = hostAndPath.split("/");
                  host = pathParts[0];
                  if (pathParts[1]) {
                    dbName = pathParts[1].split("?")[0];
                  }
                } else {
                  mongoUri = rawUrl;
                }

                if (!dbName || dbName === dbKey) {
                  dbName = await promptQuestion("Enter MongoDB Database Name", dbKey || "vexora_mongo");
                }

                if (mongoUri) {
                  try {
                    const lastAtIdx = mongoUri.lastIndexOf("@");
                    if (lastAtIdx !== -1) {
                      const hostAndPath = mongoUri.substring(lastAtIdx + 1);
                      const pathIndex = hostAndPath.indexOf("/");
                      if (pathIndex !== -1) {
                        const pathPart = hostAndPath.substring(pathIndex);
                        const qIndex = pathPart.indexOf("?");
                        const pathWithoutQuery = qIndex !== -1 ? pathPart.substring(0, qIndex) : pathPart;
                        const cleanPath = pathWithoutQuery.replace(/^\/+|\/+$/g, "");
                        
                        if (cleanPath !== dbName) {
                          const qIndexInFull = mongoUri.indexOf("?", lastAtIdx);
                          if (qIndexInFull !== -1) {
                            const beforeQuery = mongoUri.substring(0, qIndexInFull);
                            const afterQuery = mongoUri.substring(qIndexInFull);
                            mongoUri = beforeQuery.endsWith("/") ? `${beforeQuery}${dbName}${afterQuery}` : `${beforeQuery}/${dbName}${afterQuery}`;
                          } else {
                            mongoUri = mongoUri.endsWith("/") ? `${mongoUri}${dbName}` : `${mongoUri}/${dbName}`;
                          }
                        }
                      } else {
                        // No path at all, append it
                        const qIndexInFull = mongoUri.indexOf("?");
                        if (qIndexInFull !== -1) {
                          const beforeQuery = mongoUri.substring(0, qIndexInFull);
                          const afterQuery = mongoUri.substring(qIndexInFull);
                          mongoUri = beforeQuery.endsWith("/") ? `${beforeQuery}${dbName}${afterQuery}` : `${beforeQuery}/${dbName}${afterQuery}`;
                        } else {
                          mongoUri = mongoUri.endsWith("/") ? `${mongoUri}${dbName}` : `${mongoUri}/${dbName}`;
                        }
                      }
                    }
                  } catch (e) {
                    // Fallback to basic append if anything throws
                    if (!mongoUri.includes(`/${dbName}`)) {
                      mongoUri = mongoUri.endsWith("/") ? `${mongoUri}${dbName}` : `${mongoUri}/${dbName}`;
                    }
                  }
                }
              } else {
                host = await promptQuestion("3/6 Enter Database Host", "cluster0.fsiwzxu.mongodb.net");
                dbName = await promptQuestion("4/6 Enter Database Name", dbKey || "vexora_mongo");
                user = await promptQuestion("5/6 Enter Database User", "satyam");
                pass = await promptQuestion("6/6 Enter Database Password", "");

                const encPass = encodeURIComponent(pass);
                const scheme = "mongodb" + "+srv://";
                mongoUri = `${scheme}${user}:${encPass}@${host}/${dbName}?appName=Cluster0`;
              }
              retryMongo = false;
            } catch (mongoErr) {
              console.error(`\n❌ Error parsing MongoDB setup: ${mongoErr.message}`);
              const retryAns = await promptQuestion("🔄 Would you like to RETRY MongoDB setup? (y/n)", "y");
              if (retryAns.trim().toLowerCase() !== "y" && retryAns.trim().toLowerCase() !== "yes") {
                console.log("⏹ MongoDB Setup Cancelled.");
                return;
              }
            }
          }
        } else {
          host = await promptQuestion(
            "3/6 Enter Database Host (IP / domain)",
            "127.0.0.1"
          );
          dbName = await promptQuestion("4/6 Enter Database Name", dbKey);
          user = await promptQuestion("5/6 Enter Database User", "root");
          pass = await promptQuestion("6/6 Enter Database Password", "");
        }
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
        enabled: true,
        DB_HOST: host,
        DB_NAME: dbName,
        DB_USER: user,
        DB_PASS: pass,
        DB_URL: mongoUri || undefined,
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
    description: "Lists all configured database connections & opens Interactive Studio",
    category: "🗄️ Database",
    async run() {
      line();
      console.log("🗄️ VEXORA CONFIGURED DATABASES (db_config.json)");
      line();

      const configs = readDbConfig();
      const keys = Object.keys(configs);
      if (keys.length === 0) {
        console.log("  (No databases configured)");
        line();
        return;
      }

      keys.forEach((key, idx) => {
        const conf = configs[key];
        const isOff = conf.enabled === false || conf.ENABLED === false;
        const statusBadge = isOff ? " [OFF]" : " [ACTIVE]";
        console.log(
          `  ${idx + 1}. [KEY: ${key}]${statusBadge}  →  ${conf.driver || conf.DB_DRIVER || "mysql"}://${conf.DB_USER || "root"}@${conf.DB_HOST || "127.0.0.1"}/${conf.DB_NAME || "default"}`
        );
      });
      line();

      const choice = await promptQuestion(
        "👉 Enter Database Connection # or Key to open & manage (or press Enter to exit)",
        ""
      );
      const trimmed = choice.trim();
      if (!trimmed || ["back", "cancel", "exit", "0", "b"].includes(trimmed.toLowerCase())) {
        return;
      }

      let selectedKey = "";
      const num = parseInt(trimmed);
      if (!isNaN(num) && num >= 1 && num <= keys.length) {
        selectedKey = keys[num - 1];
      } else {
        selectedKey = keys.find(k => k.toLowerCase() === trimmed.toLowerCase()) || trimmed;
      }

      if (selectedKey && configs[selectedKey]) {
        await openDatabaseStudio(selectedKey);
      } else {
        console.error(`❌ Connection key '${trimmed}' not found in db_config.json`);
      }
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
    aliases: ["db:ping", "db:health"],
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

  "db:ping": {
    description: "Checks database connection health",
    category: "🗄️ Database",
    aliases: ["db:health"],
    async run(args, allCommands) {
      return dbCommands["db:status"].run(args, allCommands);
    }
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
  "db:tables": {
    description: "Lists all database tables and allows interactive viewing & editing",
    usage: "db:tables [key]",
    category: "🗄️ Database",
    aliases: ["db:table:list", "db:table-list", "db:table"],
    async run(args) {
      return dbCommands["db:table:list"].run(args);
    }
  },

  "db:table:list": {
    description: "Lists all database tables and allows interactive viewing & editing",
    usage: "db:table:list [key]",
    category: "🗄️ Database",
    aliases: ["db:tables", "db:table-list", "db:table"],
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
          } else if (driver === "mongodb") {
            const collections = await client.listCollections().toArray();
            tables = collections.map(c => c.name);
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
              } else if (driver === "mongodb") {
                count = await client.collection(tbl).countDocuments();
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
    description: "Interactively creates a new database table (Step-by-Step Column Builder)",
    usage: "db:table:create [tableName] [key]",
    category: "🗄️ Database",
    aliases: ["db:create-table", "db:make-table"],
    async run(args) {
      const rawTable = args[1] ? args[1].trim() : "";
      const rawKey = args[2] ? args[2].trim() : "";

      let tableName = rawTable;
      if (!tableName) {
        tableName = await promptQuestion("Enter New Table Name (e.g. users, posts, products)");
        if (!tableName || ["back", "b", "cancel"].includes(tableName.trim().toLowerCase())) {
          console.log("  ⏹ Cancelled.");
          return;
        }
      }

      const dbObj = await getDbClient(rawKey);
      if (!dbObj) return;

      const { client, driver, key } = dbObj;

      if (driver === "mongodb") {
        const confirm = await promptQuestion(`Create collection (table) '${tableName}' on connection '${key}'? Press Enter to confirm or 'cancel' to abort`, "y");
        if (["cancel", "no", "n", "back", "b"].includes(confirm.trim().toLowerCase())) {
          console.log("  ⏹ Table creation cancelled.");
          return;
        }
        try {
          await client.createCollection(tableName);
          console.log(`\n  ✅ Collection (Table) '${tableName}' created successfully on connection '${key}'!`);
          return;
        } catch (err) {
          console.error(`  ❌ Failed to create collection '${tableName}': ${err.message}`);
          return;
        }
      }

      line();
      console.log(`⚙️  CREATE TABLE WIZARD  [Table: '${tableName}']  [Connection: ${key}]`);
      line();
      console.log(`  📌 Column 'id' is auto-set as PRIMARY KEY (cannot be changed)\n`);

      // ─── Available data types ───
      const mysqlTypes = [
        "INT", "BIGINT", "TINYINT", "SMALLINT", "FLOAT", "DOUBLE", "DECIMAL",
        "VARCHAR", "CHAR", "TEXT", "MEDIUMTEXT", "LONGTEXT",
        "DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR",
        "BOOLEAN", "ENUM", "JSON", "BLOB"
      ];
      const pgTypes = [
        "INTEGER", "BIGINT", "SMALLINT", "REAL", "DOUBLE PRECISION", "NUMERIC",
        "VARCHAR", "CHAR", "TEXT",
        "DATE", "TIMESTAMP", "TIMESTAMPTZ", "TIME", "INTERVAL",
        "BOOLEAN", "JSON", "JSONB", "UUID", "BYTEA", "SERIAL"
      ];

      const availableTypes = driver === "postgres" ? pgTypes : mysqlTypes;

      // ─── Columns collector ───
      const columns = [];

      // Auto-add id column (non-removable)
      if (driver === "postgres") {
        columns.push({ name: "id", type: "SERIAL", size: "", nullable: false, index: "PRIMARY KEY", auto: true });
      } else {
        columns.push({ name: "id", type: "INT", size: "", nullable: false, index: "PRIMARY KEY", auto: true, extra: "AUTO_INCREMENT" });
      }

      // ─── Step-by-step column addition loop (with back support) ───
      // Steps: 1=Name, 2=Type, 3=Size, 4=Nullable, 5=Default, 6=Index
      const isBack = (val) => ["back", "b", "cancel"].includes((val || "").trim().toLowerCase());

      let colNum = 1;
      let outerDone = false;
      while (!outerDone) {
        try {
          console.log(`\n  ── Add Column #${colNum} ──`);

          let step = 1;
          let colName = "", upperType = "", colSize = "", nullable = true, defaultVal = "", index = "";
          let needsSize = false;

          while (step >= 1 && step <= 6) {

            // ── Step 1: Column Name ──
            if (step === 1) {
              const input = await promptQuestion(`Column Name (or 'done' to finish)`, "");
              const trimmed = (input || "").trim().toLowerCase();
              if (!trimmed || ["done", "finish", "f", "end"].includes(trimmed)) { outerDone = true; break; }
              if (isBack(input)) {
                if (columns.length <= 1) {
                  console.log("  ⏹ Cancelled.");
                  return;
                }
                outerDone = true; break;
              }
              // Validate column name
              if (/[^a-zA-Z0-9_]/.test(input.trim())) {
                console.log(`  ❌ Invalid column name '${input.trim()}'. Use only letters, numbers, underscores.`);
                continue; // re-ask step 1
              }
              // Check duplicate
              if (columns.some(c => c.name.toLowerCase() === trimmed)) {
                console.log(`  ⚠️  Column '${input.trim()}' already exists! Try a different name.`);
                continue; // re-ask step 1
              }
              colName = input.trim();
              step = 2;
            }

            // ── Step 2: Data Type ──
            else if (step === 2) {
              console.log(`  📋 Short keys: v=VARCHAR, i=${driver === "postgres" ? "INTEGER" : "INT"}, b=BIGINT, t=TEXT, e=ENUM, d=DATE, dt=DATETIME, bool=BOOLEAN, j=JSON, f=FLOAT`);
              console.log(`  📋 Available types: ${availableTypes.join(", ")}`);
              let typeResolved = false;
              while (!typeResolved) {
                const colType = await promptQuestion(`Data Type for '${colName}'`, "VARCHAR");
                if (isBack(colType)) { step = 1; break; }

                const cleanInput = (colType || "VARCHAR").trim().toLowerCase();
                const typeMap = {
                  v: "VARCHAR", var: "VARCHAR", varchar: "VARCHAR", str: "VARCHAR", string: "VARCHAR",
                  i: driver === "postgres" ? "INTEGER" : "INT", int: driver === "postgres" ? "INTEGER" : "INT", integer: driver === "postgres" ? "INTEGER" : "INT", num: driver === "postgres" ? "INTEGER" : "INT",
                  b: "BIGINT", big: "BIGINT", bigint: "BIGINT",
                  t: "TEXT", txt: "TEXT", text: "TEXT",
                  d: "DATE", date: "DATE",
                  dt: "DATETIME", datetime: "DATETIME",
                  ts: "TIMESTAMP", timestamp: "TIMESTAMP",
                  e: "ENUM", enum: "ENUM",
                  j: "JSON", json: "JSON",
                  bool: "BOOLEAN", boolean: "BOOLEAN",
                  f: "FLOAT", float: "FLOAT",
                  dec: "DECIMAL", decimal: "DECIMAL",
                  c: "CHAR", char: "CHAR",
                  uuid: "UUID", blob: "BLOB"
                };

                let resolved = typeMap[cleanInput];
                if (!resolved) {
                  const upper = cleanInput.toUpperCase();
                  if (availableTypes.includes(upper)) {
                    resolved = upper;
                  } else {
                    const matches = availableTypes.filter(t => t.startsWith(upper));
                    if (matches.length === 1) resolved = matches[0];
                  }
                }

                if (resolved && availableTypes.includes(resolved)) {
                  upperType = resolved;
                  if (cleanInput.toUpperCase() !== resolved) {
                    console.log(`  👉 Selected type: ${resolved} (shortcut '${colType.trim()}')`);
                  }
                  typeResolved = true;
                  needsSize = ["VARCHAR", "CHAR", "DECIMAL", "NUMERIC", "ENUM"].includes(upperType);
                  step = needsSize ? 3 : 4;
                } else {
                  console.log(`  ❌ Invalid type '${colType.trim()}'. Choose from list or use shortcuts (v, i, b, t, e, d, dt, bool, j).`);
                }
              }
            }

            // ── Step 3: Size (only for VARCHAR, CHAR, DECIMAL, NUMERIC, ENUM) ──
            else if (step === 3) {
              const defaultSize = upperType === "VARCHAR" ? "255" : upperType === "CHAR" ? "1" : upperType === "DECIMAL" || upperType === "NUMERIC" ? "10,2" : "";
              let sizeInput;
              if (upperType === "ENUM") {
                sizeInput = await promptQuestion(`ENUM values (comma separated, e.g. active,inactive,pending)`, "active,inactive");
              } else {
                sizeInput = await promptQuestion(`Size for ${upperType}`, defaultSize);
              }
              if (isBack(sizeInput)) { step = 2; continue; }
              colSize = (sizeInput || "").trim();
              step = 4;
            }

            // ── Step 4: Nullable ──
            else if (step === 4) {
              const nullableChoice = await promptQuestion(`Allow NULL? (y/n)`, "y");
              if (isBack(nullableChoice)) { step = needsSize ? 3 : 2; continue; }
              const nv = (nullableChoice || "y").trim().toLowerCase();
              if (nv === "y" || nv === "yes") { nullable = true; step = 5; }
              else if (nv === "n" || nv === "no") { nullable = false; step = 5; }
              else { console.log(`  ❌ Invalid input '${nullableChoice.trim()}'. Enter 'y' or 'n'.`); }
            }

            // ── Step 5: Default Value ──
            else if (step === 5) {
              const defInput = await promptQuestion(`Default value (press Enter for none)`, "");
              if (isBack(defInput)) { step = 4; continue; }
              defaultVal = (defInput || "").trim();
              step = 6;
            }

            // ── Step 6: Index ──
            else if (step === 6) {
              console.log(`  📋 Index options: none, INDEX, UNIQUE`);
              let indexResolved = false;
              while (!indexResolved) {
                const indexChoice = await promptQuestion(`Index type`, "none");
                if (isBack(indexChoice)) { step = 5; break; }
                const iv = (indexChoice || "none").trim().toUpperCase();
                if (iv === "NONE" || iv === "") { index = ""; indexResolved = true; }
                else if (iv === "INDEX" || iv === "UNIQUE") { index = iv; indexResolved = true; }
                else { console.log(`  ❌ Invalid index '${indexChoice.trim()}'. Choose: none, INDEX, UNIQUE`); }
              }
              if (indexResolved) step = 7; // done with this column
            }
          }

          // If outerDone, exit the main loop
          if (outerDone) break;

          // If step reached 7, column is fully defined - add it
          if (step === 7) {
            columns.push({
              name: colName,
              type: upperType,
              size: colSize,
              nullable,
              defaultValue: defaultVal,
              index,
              auto: false
            });
            console.log(`  ✅ Column '${colName}' (${upperType}${colSize ? `(${colSize})` : ""}) added!`);
            colNum++;
          }
        } catch (e) {
          console.log(`  ⚠️  Input error: ${e.message || "unexpected"}. Try again or type 'done' to finish.`);
        }
      }


      // ─── Auto-add timestamp columns ───
      const addTimestamps = await promptQuestion("Add created_at & updated_at timestamp columns? (y/n)", "y");
      if (addTimestamps.trim().toLowerCase() === "y" || addTimestamps.trim().toLowerCase() === "yes") {
        if (driver === "postgres") {
          columns.push({ name: "created_at", type: "TIMESTAMP", size: "", nullable: false, defaultValue: "CURRENT_TIMESTAMP", index: "", auto: true });
          columns.push({ name: "updated_at", type: "TIMESTAMP", size: "", nullable: false, defaultValue: "CURRENT_TIMESTAMP", index: "", auto: true });
        } else {
          columns.push({ name: "created_at", type: "DATETIME", size: "", nullable: false, defaultValue: "CURRENT_TIMESTAMP", index: "", auto: true });
          columns.push({ name: "updated_at", type: "DATETIME", size: "", nullable: false, defaultValue: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", index: "", auto: true });
        }
      }

      if (columns.length <= 1) {
        console.log("  ⚠️  No columns added (only 'id'). Table creation cancelled.");
        return;
      }

      // ─── Preview table structure ───
      console.log("");
      line();
      console.log(`  📐 TABLE STRUCTURE PREVIEW: '${tableName}'`);
      line();

      // Build preview table data
      const previewRows = columns.map((col, idx) => ({
        "#": idx + 1,
        Column: col.name,
        Type: col.size
          ? (col.type === "ENUM" ? `ENUM('${col.size.split(",").join("','")}')` : `${col.type}(${col.size})`)
          : col.type,
        Null: col.nullable ? "YES" : "NO",
        Key: col.index === "PRIMARY KEY" ? "PRI" : col.index === "UNIQUE" ? "UNI" : col.index === "INDEX" ? "MUL" : "-",
        Default: col.defaultValue || (col.extra ? col.extra : "-"),
        Extra: col.extra || (col.auto && col.name === "id" ? (driver === "postgres" ? "SERIAL" : "AUTO_INCREMENT") : "-")
      }));

      renderConsoleTable(previewRows);

      console.log(`\n  📊 Total columns: ${columns.length}`);
      line();

      // ─── Final confirmation ───
      const confirm = await promptQuestion("Create this table? Press Enter to confirm or 'cancel' to abort", "y");
      if (["cancel", "no", "n", "back", "b"].includes(confirm.trim().toLowerCase())) {
        console.log("  ⏹ Table creation cancelled.");
        return;
      }

      if (driver === "mongodb") {
        try {
          await client.createCollection(tableName);
          console.log(`\n  ✅ Collection (Table) '${tableName}' created successfully on connection '${key}'!`);
          return;
        } catch (err) {
          console.error(`  ❌ Failed to create collection '${tableName}': ${err.message}`);
          return;
        }
      }

      // ─── Build SQL ───
      const colDefs = [];
      const indexDefs = [];

      for (const col of columns) {
        if (col.name === "id") {
          if (driver === "postgres") {
            colDefs.push(`"id" SERIAL PRIMARY KEY`);
          } else {
            colDefs.push("`id` INT AUTO_INCREMENT PRIMARY KEY");
          }
          continue;
        }

        let def = "";
        const quotedName = driver === "postgres" ? `"${col.name}"` : `\`${col.name}\``;

        // Type with size
        let typePart = col.type;
        if (col.size) {
          if (col.type === "ENUM") {
            typePart = `ENUM('${col.size.split(",").map(v => v.trim()).join("','")}')`;
          } else {
            typePart = `${col.type}(${col.size})`;
          }
        }

        def = `${quotedName} ${typePart}`;

        // Nullable
        if (!col.nullable) def += " NOT NULL";

        // Default
        if (col.defaultValue) {
          const dv = col.defaultValue;
          // Don't quote function-like defaults
          if (/^(CURRENT_TIMESTAMP|NOW\(\)|NULL|TRUE|FALSE|\d+)/i.test(dv)) {
            def += ` DEFAULT ${dv}`;
          } else {
            def += ` DEFAULT '${dv}'`;
          }
        }

        colDefs.push(def);

        // Indexes (non-primary)
        if (col.index === "UNIQUE") {
          if (driver === "postgres") {
            indexDefs.push(`UNIQUE ("${col.name}")`);
          } else {
            indexDefs.push(`UNIQUE KEY \`idx_${col.name}\` (\`${col.name}\`)`);
          }
        } else if (col.index === "INDEX") {
          if (driver !== "postgres") {
            indexDefs.push(`INDEX \`idx_${col.name}\` (\`${col.name}\`)`);
          }
        }
      }

      const allParts = [...colDefs, ...indexDefs];
      const createSQL = driver === "postgres"
        ? `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${allParts.join(",\n  ")}\n)`
        : `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n  ${allParts.join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

      try {
        await client.query(createSQL);
        console.log(`\n  ✅ Table '${tableName}' created successfully on connection '${key}'!`);

        // Add indexes for postgres separately
        if (driver === "postgres") {
          for (const col of columns) {
            if (col.index === "INDEX") {
              try {
                await client.query(`CREATE INDEX "idx_${col.name}" ON "${tableName}" ("${col.name}")`);
              } catch (e) { /* ignore if already exists */ }
            }
          }
        }
      } catch (err) {
        console.error(`  ❌ Failed to create table '${tableName}': ${err.message}`);
        console.log(`\n  📝 Generated SQL:\n  ${createSQL}\n`);
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
        if (driver === "mongodb") {
          await client.collection(tableName).drop();
        } else {
          const dropQuery = driver === "postgres"
            ? `DROP TABLE IF EXISTS "${tableName}" CASCADE`
            : `DROP TABLE IF EXISTS \`${tableName}\``;
          await client.query(dropQuery);
        }
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
        if (driver === "mongodb") {
          await client.collection(tableName).deleteMany({});
        } else {
          const truncQuery = driver === "postgres"
            ? `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`
            : `TRUNCATE TABLE \`${tableName}\``;
          await client.query(truncQuery);
        }
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
        } else if (driver === "mongodb") {
          const doc = await client.collection(tableName).findOne();
          if (doc) {
            Object.keys(doc).forEach(k => {
              const val = doc[k];
              const type = val === null ? "null" : typeof val;
              console.log(`  • ${k.padEnd(20)} : ${type.padEnd(15)}`);
            });
          } else {
            console.log("  (Collection is empty - no schema/keys detected)");
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
      const spinner = startSpinner(`Executing SQL on '${key}'...`);
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
        spinner.stop(true, `Query executed (${duration}ms)`);

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

export async function openDatabaseStudio(dbKey) {
  const configs = readDbConfig();
  let conf = configs[dbKey];
  if (!conf) {
    console.error(`❌ Connection key '${dbKey}' not found in db_config.json`);
    return;
  }

  const isEnabled = conf.enabled !== false && conf.ENABLED !== false && conf.enabled !== "false";
  if (!isEnabled) {
    console.error(`\n❌ DATABASE ERROR: Database connection '${dbKey}' is turned OFF (enabled: false).`);
    console.log("👉 Set 'enabled: true' in .vexora_config/db_config.json to enable access.\n");
    return;
  }

  let driver = (conf.driver || conf.DB_DRIVER || "mysql").toLowerCase();

  const dbObj = await getDbClient(dbKey);
  if (!dbObj) return;

  const { client, key, dbName } = dbObj;
  driver = dbObj.driver;
  conf = configs[key];

  // ─── HELPER: Fetch all table names ───
  async function fetchTablesList() {
    let tables = [];
    try {
      if (driver === "postgres") {
        const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
        tables = res.rows.map(r => r.tablename);
      } else if (driver === "mongodb") {
        const collections = await client.listCollections().toArray();
        tables = collections.map(c => c.name);
      } else {
        const [rows] = await client.query("SHOW TABLES");
        tables = rows.map(r => Object.values(r)[0]);
      }
    } catch (e) {
      console.error(`❌ Error fetching tables: ${e.message}`);
    }
    return tables;
  }

  // ─── HELPER: Fetch row count for a table ───
  async function getRowCount(tbl) {
    try {
      if (driver === "postgres") {
        const res = await client.query(`SELECT COUNT(*) AS total FROM "${tbl}"`);
        return res.rows[0].total;
      } else if (driver === "mongodb") {
        return await client.collection(tbl).countDocuments();
      } else {
        const [rows] = await client.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
        return rows[0].total;
      }
    } catch (e) { return "?"; }
  }

  // ─── HELPER: Fetch table data (sorted newest first) ───
  async function fetchTableData(tbl, limitVal = 30) {
    try {
      const parsedLimit = parseInt(limitVal, 10) || 30;
      if (driver === "postgres") {
        const res = await client.query(`SELECT * FROM "${tbl}" ORDER BY 1 DESC LIMIT ${parsedLimit}`);
        return res.rows;
      } else if (driver === "mongodb") {
        return await client.collection(tbl).find().sort({ _id: -1 }).limit(parsedLimit).toArray();
      } else {
        const [rows] = await client.query(`SELECT * FROM \`${tbl}\` ORDER BY 1 DESC LIMIT ${parsedLimit}`);
        return rows;
      }
    } catch (e) {
      console.error(`❌ Error fetching data: ${e.message}`);
      return [];
    }
  }

  // ─── HELPER: Show table schema ───
  async function showSchema(tbl) {
    try {
      if (driver === "postgres") {
        const res = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`, [tbl]);
        res.rows.forEach(r => console.log(`  │ ${r.column_name.padEnd(20)} │ ${(r.data_type).padEnd(15)} │ Nullable: ${r.is_nullable.padEnd(3)} │`));
      } else if (driver === "mongodb") {
        const doc = await client.collection(tbl).findOne();
        if (doc) {
          Object.keys(doc).forEach(k => {
            const val = doc[k];
            const type = val === null ? "null" : typeof val;
            console.log(`  │ ${k.padEnd(20)} │ ${type.padEnd(15)} │`);
          });
        } else {
          console.log("  (Collection is empty - no schema columns detected)");
        }
      } else {
        const [rows] = await client.query(`DESCRIBE \`${tbl}\``);
        rows.forEach(r => console.log(`  │ ${String(r.Field).padEnd(20)} │ ${String(r.Type).padEnd(15)} │ Null: ${String(r.Null).padEnd(3)} │ Key: ${String(r.Key || "-").padEnd(3)} │`));
      }
    } catch (err) {
      console.error(`  ❌ Error reading schema: ${err.message}`);
    }
  }

  // ─── HELPER: Fetch detailed column schema with ENUM values ───
  async function getDetailedSchema(tbl) {
    const schemaMap = {};
    try {
      if (driver === "postgres") {
        const res = await client.query(
          `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = $1`,
          [tbl]
        );
        for (const r of res.rows) {
          const cName = r.column_name;
          let enumValues = [];
          if (r.data_type === "USER-DEFINED" || r.udt_name) {
            try {
              const enumRes = await client.query(
                `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = $1 ORDER BY enumsortorder`,
                [r.udt_name]
              );
              enumValues = enumRes.rows.map(e => e.enumlabel);
            } catch (e) {}
          }
          schemaMap[cName.toLowerCase()] = {
            name: cName,
            type: r.data_type,
            isEnum: enumValues.length > 0,
            enumValues
          };
        }
      } else if (driver === "mongodb") {
        const doc = await client.collection(tbl).findOne();
        if (doc) {
          for (const k of Object.keys(doc)) {
            const val = doc[k];
            const type = val === null ? "null" : typeof val;
            schemaMap[k.toLowerCase()] = {
              name: k,
              type,
              isEnum: false,
              enumValues: []
            };
          }
        } else {
          // Default columns if empty so studio can insert
          schemaMap["title"] = { name: "title", type: "string", isEnum: false, enumValues: [] };
          schemaMap["status"] = { name: "status", type: "string", isEnum: false, enumValues: [] };
        }
      } else {
        const [rows] = await client.query(`DESCRIBE \`${tbl}\``);
        for (const r of rows) {
          const cName = r.Field;
          const rawType = String(r.Type || "");
          const isEnum = /^enum\(/i.test(rawType);
          let enumValues = [];
          if (isEnum) {
            const matches = [...rawType.matchAll(/'([^']+)'/g)];
            enumValues = matches.map(m => m[1]);
          }
          schemaMap[cName.toLowerCase()] = {
            name: cName,
            type: rawType,
            isEnum,
            enumValues
          };
        }
      }
    } catch (e) {}
    return schemaMap;
  }

  // ─── HELPER: Prompt value for a column with ENUM shortcut support ───
  async function promptColumnValue(colName, colSchema) {
    if (colSchema && colSchema.isEnum && colSchema.enumValues.length > 0) {
      const vals = colSchema.enumValues;
      console.log(`\n  📋 Column '${colName}' is ENUM. Available options:`);
      vals.forEach((v, idx) => {
        console.log(`     [${idx + 1}] ${v}`);
      });
      console.log(`  (Enter #1-${vals.length}, full value, or shortcut like '${vals[0][0]}')`);

      while (true) {
        const val = await promptQuestion(`Select value for '${colName}'`, "");
        const input = (val || "").trim();
        if (!input || ["back", "b", "cancel"].includes(input.toLowerCase())) return "__CANCEL__";

        // 1. Numeric shortcut (1-indexed)
        const num = parseInt(input, 10);
        if (!isNaN(num) && num >= 1 && num <= vals.length) {
          const chosen = vals[num - 1];
          console.log(`  👉 Selected ENUM: '${chosen}'`);
          return chosen;
        }

        // 2. Exact match (case-insensitive)
        const exact = vals.find(v => v.toLowerCase() === input.toLowerCase());
        if (exact) return exact;

        // 3. Prefix shortcut match
        const matches = vals.filter(v => v.toLowerCase().startsWith(input.toLowerCase()));
        if (matches.length === 1) {
          console.log(`  👉 Selected ENUM shortcut match: '${matches[0]}'`);
          return matches[0];
        } else if (matches.length > 1) {
          console.log(`  ⚠️  Multiple ENUM options match '${input}': ${matches.join(", ")}. Be more specific or use numbers #1-${vals.length}.`);
          continue;
        }

        console.log(`  ❌ Invalid ENUM value '${input}'. Options are: ${vals.map((v, i) => `[${i+1}] ${v}`).join(", ")}`);
      }
    } else {
      const val = await promptQuestion(`Enter value for '${colName}' (or 'back' to cancel)`, "");
      const input = (val || "").trim();
      if (["back", "b", "cancel"].includes(input.toLowerCase())) return "__CANCEL__";
      return input;
    }
  }

  // ─── HELPER: Insert record ───
  async function insertRecord(tbl) {
    console.log(`\n  ➕ INSERT NEW RECORD INTO '${tbl}'`);
    line();

    const schemaMap = await getDetailedSchema(tbl);
    const columns = Object.keys(schemaMap).map(k => schemaMap[k].name);

    if (columns.length === 0) {
      console.error("  ❌ Could not read table columns.");
      return;
    }

    const skipCols = ["id", "_id", "created_at", "updated_at"];
    const writeCols = columns.filter(c => !skipCols.includes(c.toLowerCase()));

    console.log(`  📌 Writable columns: ${writeCols.join(", ")}`);
    console.log(`  (Columns like id, _id, created_at, updated_at are auto-managed)`);
    line();

    const data = {};
    for (const col of writeCols) {
      const colMeta = schemaMap[col.toLowerCase()];
      const val = await promptColumnValue(col, colMeta);
      if (val === "__CANCEL__") return;
      data[col] = val;
    }

    try {
      if (driver === "postgres") {
        const cols = Object.keys(data);
        if (cols.length === 0) return;
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`INSERT INTO "${tbl}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders})`, Object.values(data));
      } else if (driver === "mongodb") {
        const resSeq = await client.db().collection("counters").findOneAndUpdate(
          { _id: tbl },
          { $inc: { seq: 1 } },
          { returnDocument: "after", upsert: true }
        );
        const docSeq = resSeq && resSeq.value ? resSeq.value : resSeq;
        const seq = docSeq && typeof docSeq.seq === "number" ? docSeq.seq : 1;
        data._id = seq;
        data.id = seq;
        await client.collection(tbl).insertOne(data);
      } else {
        const cols = Object.keys(data);
        if (cols.length === 0) return;
        const placeholders = cols.map(() => "?").join(", ");
        await client.query(`INSERT INTO \`${tbl}\` (${cols.map(c => `\`${c}\``).join(", ")}) VALUES (${placeholders})`, Object.values(data));
      }
      console.log(`  ✅ Record inserted successfully into '${tbl}'!`);
    } catch (e) {
      console.error(`  ❌ Insert Error: ${e.message}`);
    }
  }

  // ─── HELPER: Update record ───
  async function updateRecord(tbl) {
    console.log(`\n  ✏️  UPDATE RECORD IN '${tbl}'`);
    line();

    const schemaMap = await getDetailedSchema(tbl);
    const columns = Object.keys(schemaMap).map(k => schemaMap[k].name);
    if (columns.length === 0) {
      console.error("  ❌ Could not read table columns.");
      return;
    }

    const skipCols = ["id", "created_at", "updated_at"];
    const writeCols = columns.filter(c => !skipCols.includes(c.toLowerCase()));

    console.log(`  📌 Writable columns: ${writeCols.map(c => {
      const info = schemaMap[c.toLowerCase()];
      return info && info.isEnum ? `${c} (ENUM: ${info.enumValues.join(",")})` : c;
    }).join(", ")}`);
    line();

    let colName = "";
    let colMeta = null;

    while (true) {
      const inputCol = await promptQuestion("Enter Column Name to update (e.g. status, title)", "");
      const trimmed = (inputCol || "").trim();
      if (!trimmed || ["back", "b", "cancel"].includes(trimmed.toLowerCase())) return;

      const foundKey = Object.keys(schemaMap).find(k => k === trimmed.toLowerCase() || schemaMap[k].name.toLowerCase() === trimmed.toLowerCase());
      if (foundKey) {
        colMeta = schemaMap[foundKey];
        colName = colMeta.name;
        break;
      }

      console.log(`  ❌ Column '${trimmed}' does not exist. Available: ${writeCols.join(", ")}`);
    }

    const newVal = await promptColumnValue(colName, colMeta);
    if (newVal === "__CANCEL__") return;

    const rawWhere = await promptQuestion("Enter row ID or WHERE clause (e.g. 5 or id = 5)", "");
    if (!rawWhere || ["back", "b", "cancel"].includes(rawWhere.trim().toLowerCase())) return;

    const whereCond = formatWhereClause(rawWhere);
    const confirm = await promptQuestion(`⚠️  UPDATE '${tbl}' SET ${colName}='${newVal}' WHERE ${whereCond}? (y/n)`, "n");
    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
      console.log("  ⏹ Update cancelled.");
      return;
    }

    try {
      if (driver === "postgres") {
        await client.query(`UPDATE "${tbl}" SET "${colName}" = $1 WHERE ${whereCond}`, [newVal]);
      } else if (driver === "mongodb") {
        let filter = {};
        if (/^[0-9a-fA-F]{24}$/.test(rawWhere.trim())) {
          const { ObjectId } = await import("mongodb");
          filter = { _id: new ObjectId(rawWhere.trim()) };
        } else if (rawWhere.includes("=")) {
          const parts = rawWhere.split("=");
          const k = parts[0].trim();
          let v = parts[1].trim().replace(/^['"]|['"]$/g, "");
          filter = { [k]: v };
        } else {
          filter = { id: parseInt(rawWhere.trim(), 10) || rawWhere.trim() };
        }
        await client.collection(tbl).updateMany(filter, { $set: { [colName]: newVal } });
      } else {
        await client.query(`UPDATE \`${tbl}\` SET \`${colName}\` = ? WHERE ${whereCond}`, [newVal]);
      }
      console.log(`  ✅ Record updated successfully in '${tbl}'!`);
    } catch (e) {
      console.error(`  ❌ Update Error: ${e.message}`);
    }
  }

  // ─── HELPER: Delete record ───
  async function deleteRecord(tbl) {
    console.log(`\n  🗑️  DELETE RECORD FROM '${tbl}'`);
    line();
    const rawWhere = await promptQuestion("  Enter row ID to delete (e.g. 5) or WHERE clause (e.g. id = 5)", "");
    if (!rawWhere || ["back", "b", "cancel"].includes(rawWhere.trim().toLowerCase())) return;

    const whereCond = formatWhereClause(rawWhere);
    const confirm = await promptQuestion(`  ⚠️  DELETE FROM '${tbl}' WHERE ${whereCond}? (y/n)`, "n");
    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
      console.log("  ⏹ Delete cancelled.");
      return;
    }

    try {
      if (driver === "mongodb") {
        let filter = {};
        if (/^[0-9a-fA-F]{24}$/.test(rawWhere.trim())) {
          const { ObjectId } = await import("mongodb");
          filter = { _id: new ObjectId(rawWhere.trim()) };
        } else if (rawWhere.includes("=")) {
          const parts = rawWhere.split("=");
          const k = parts[0].trim();
          let v = parts[1].trim().replace(/^['"]|['"]$/g, "");
          filter = { [k]: v };
        } else {
          filter = { id: parseInt(rawWhere.trim(), 10) || rawWhere.trim() };
        }
        await client.collection(tbl).deleteMany(filter);
      } else {
        const delQuery = driver === "postgres"
          ? `DELETE FROM "${tbl}" WHERE ${whereCond}`
          : `DELETE FROM \`${tbl}\` WHERE ${whereCond}`;
        await client.query(delQuery);
      }
      console.log(`  ✅ Record(s) deleted from '${tbl}' successfully!`);
    } catch (e) {
      console.error(`  ❌ Delete Error: ${e.message}`);
    }
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  MAIN STUDIO LOOP: Tables List → Select → Data → Actions   ║
  // ╚══════════════════════════════════════════════════════════════╝

  console.log(`  ✅ Connected to '${key}' (${dbName || "default"})!\n`);

  while (true) {
    // ── STEP 1: Show all tables ──
    line();
    console.log(`⚡ DATABASE STUDIO  [${key}]  ${driver.toUpperCase()}://${conf.DB_HOST || "127.0.0.1"}/${dbName || "default"}`);
    line();

    const tables = await fetchTablesList();
    if (tables.length === 0) {
      console.log("  (No tables found in this database)");
      line();
      const action = await promptQuestion("  [c] Create New Table | [q] Run Custom SQL | [b] Exit Studio", "b");
      const a = action.trim().toLowerCase();
      if (a === "c") {
        await dbCommands["db:table:create"].run(["db:table:create", "", key]);
        continue;
      } else if (a === "q") {
        const sql = await promptQuestion("  Enter SQL Query", "");
        if (sql && !["back", "b", "cancel"].includes(sql.trim().toLowerCase())) {
          await dbCommands["db:query"].run(["db:query", sql, key]);
        }
        continue;
      }
      break;
    }

    // Show tables with row counts
    const tableData = [];
    for (let i = 0; i < tables.length; i++) {
      const count = await getRowCount(tables[i]);
      tableData.push({ serial: i + 1, name: tables[i], rows: count });
    }

    console.log(`  📋 TABLES IN DATABASE (${tables.length} found):\n`);
    for (const td of tableData) {
      console.log(`   ${String(td.serial).padStart(3)}.  📄 ${td.name.padEnd(30)} ${td.rows} rows`);
    }

    console.log("");
    line();
    console.log("  [#] Select Table by Number    [c] Create Table    [q] Run SQL    [b] Exit Studio");
    line();

    const tblChoice = await promptQuestion("Select Table # or name (or 'b' to exit)", "");
    const trimmed = tblChoice.trim();

    if (!trimmed) {
      continue;
    }

    if (["back", "cancel", "exit", "0", "b"].includes(trimmed.toLowerCase())) {
      console.log(`  ⏹ Exiting DB Studio for '${key}'...\n`);
      break;
    }

    if (trimmed.toLowerCase() === "c") {
      await dbCommands["db:table:create"].run(["db:table:create", "", key]);
      continue;
    }

    if (trimmed.toLowerCase() === "q") {
      const sql = await promptQuestion("  Enter SQL Query or Trigger", "");
      if (sql && !["back", "b", "cancel"].includes(sql.trim().toLowerCase())) {
        await dbCommands["db:query"].run(["db:query", sql, key]);
      }
      continue;
    }

    // Resolve table name
    let selectedTable = null;
    const num = parseInt(trimmed);
    if (!isNaN(num) && num >= 1 && num <= tableData.length) {
      selectedTable = tableData[num - 1].name;
    } else {
      selectedTable = tableData.find(t => t.name.toLowerCase() === trimmed.toLowerCase())?.name || trimmed;
    }

    // ── STEP 2: Table Detail Loop ──
    let stayInTable = true;
    let currentDisplayLimit = 30;
    while (stayInTable) {
      line();
      const rowCount = await getRowCount(selectedTable);
      console.log(`📋 TABLE: '${selectedTable}'  [Connection: ${key}]  [Total Rows: ${rowCount}]`);
      line();

      // Show schema
      console.log(`  📐 SCHEMA:`);
      await showSchema(selectedTable);

      // Show data (newest first)
      console.log("");
      const dataRows = await fetchTableData(selectedTable, currentDisplayLimit);
      console.log(`  📖 DATA (Showing latest ${dataRows.length} of ${rowCount} total rows, sorted newest first):`);
      console.log("");

      if (!dataRows || dataRows.length === 0) {
        console.log(`  (Table '${selectedTable}' is empty)`);
      } else {
        renderConsoleTable(dataRows);
      }

      const isEmpty = !dataRows || dataRows.length === 0;

      console.log("");
      line();
      if (isEmpty) {
        console.log("  [i] Insert Record    [l] Rows Limit (" + currentDisplayLimit + ")    [s] Schema    [q] Run SQL");
        console.log("  [drop] Drop Table    [b] ← Back to Tables List");
      } else {
        console.log("  [i] Insert    [u] Update    [d] Delete    [l] Rows Limit (" + currentDisplayLimit + ")    [s] Schema    [q] Run SQL");
        console.log("  [drop] Drop Table    [trunc] Truncate Table    [b] ← Back to Tables List");
      }
      line();

      const action = await promptQuestion("Action", "b");
      const act = action.trim().toLowerCase();

      if (act === "b" || act === "back" || !act) {
        stayInTable = false;
      } else if (act === "l" || act === "limit") {
        const inputLim = await promptQuestion(`Enter rows limit to display (Current: ${currentDisplayLimit})`, String(currentDisplayLimit));
        const p = parseInt(inputLim, 10);
        if (!isNaN(p) && p > 0) {
          currentDisplayLimit = p;
          console.log(`  👉 Display limit updated to ${currentDisplayLimit} rows.`);
        }
      } else if (act === "i" || act === "insert") {
        await insertRecord(selectedTable);
      } else if (act === "u" || act === "update") {
        if (isEmpty) {
          console.log(`\n  ⚠️ Table '${selectedTable}' is empty. No records to update. Use [i] to insert a new record.\n`);
        } else {
          await updateRecord(selectedTable);
        }
      } else if (act === "d" || act === "delete") {
        if (isEmpty) {
          console.log(`\n  ⚠️ Table '${selectedTable}' is empty. No records to delete.\n`);
        } else {
          await deleteRecord(selectedTable);
        }
      } else if (act === "s" || act === "schema") {
        line();
        console.log(`  📐 FULL SCHEMA FOR '${selectedTable}':`);
        line();
        await showSchema(selectedTable);
        line();
        await promptQuestion("Press Enter to continue...", "");
      } else if (act === "q" || act === "sql") {
        const sql = await promptQuestion("Enter SQL Query", "");
        if (sql && !["back", "b", "cancel"].includes(sql.trim().toLowerCase())) {
          try {
            const startTime = performance.now();
            let results;
            if (driver === "postgres") {
              const res = await client.query(sql);
              results = res.rows || res;
            } else {
              const [rows] = await client.query(sql);
              results = rows;
            }
            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`\n  🟢 QUERY EXECUTED (${duration}ms)`);
            if (Array.isArray(results) && results.length > 0) {
              renderConsoleTable(results);
            } else {
              console.dir(results, { depth: null, colors: true });
            }
          } catch (e) {
            console.error(`  ❌ SQL Error: ${e.message}`);
          }
        }
      } else if (act === "drop") {
        const confirm = await promptQuestion(`⚠️  DROP TABLE '${selectedTable}' PERMANENTLY? (y/n)`, "n");
        if (confirm.toLowerCase() === "y" || confirm.toLowerCase() === "yes") {
          try {
            const dropQ = driver === "postgres" ? `DROP TABLE IF EXISTS "${selectedTable}"` : `DROP TABLE IF EXISTS \`${selectedTable}\``;
            await client.query(dropQ);
            console.log(`  ✅ Table '${selectedTable}' dropped successfully!`);
            stayInTable = false;
          } catch (e) {
            console.error(`  ❌ Drop Error: ${e.message}`);
          }
        }
      } else if (act === "trunc" || act === "truncate") {
        if (isEmpty) {
          console.log(`\n  ⚠️ Table '${selectedTable}' is already empty.\n`);
        } else {
          const confirm = await promptQuestion(`⚠️  TRUNCATE (clear all data from) '${selectedTable}'? (y/n)`, "n");
          if (confirm.toLowerCase() === "y" || confirm.toLowerCase() === "yes") {
            try {
              const truncQ = driver === "postgres" ? `TRUNCATE TABLE "${selectedTable}"` : `TRUNCATE TABLE \`${selectedTable}\``;
              await client.query(truncQ);
              console.log(`  ✅ Table '${selectedTable}' truncated successfully!`);
            } catch (e) {
              console.error(`  ❌ Truncate Error: ${e.message}`);
            }
          }
        }
      }
    }
  }
}

