/**
 * Vexora Framework - Route Commands
 */

import fs from "node:fs";
import path from "node:path";
import { rootDir, apiRoutesDir, controllersDir, ensureDir, line } from "./helpers.js";

export const routeCommands = {
  "create:api": {
    description: "Interactively generates an API route with warning, DB table/column introspection, code preview, VS Code editor & live test",
    usage: "create:api [routePath]",
    category: "📌 Routes",
    aliases: ["make:api-route", "api:create", "add:api"],
    async run(args) {
      const { promptQuestion, line, rootDir, apiRoutesDir, ensureDir, readDbConfig } = await import("./helpers.js");
      const { execSync } = await import("node:child_process");
      const Database = (await import("../database/Database.js")).default;

      line();
      console.log(`⚠️  WARNING: VEXORA AUTO API GENERATOR WIZARD`);
      line();
      console.log(`📌 Note: This tool scaffolds API route endpoints automatically.`);
      console.log(`⚠️  IMPORTANT: Do NOT 100% blindly trust auto-generated API code!`);
      console.log(`👉 Always manually test, audit security, and verify logic before using in production.`);
      line();

      let routePath = args[1] ? args[1].trim() : "";

      // ─── Step 1: API Route Path ───
      if (!routePath) {
        routePath = await promptQuestion("Step 1/7: Enter API Route Path (e.g. auth/login, users/profile, products/create)", "auth/login");
      }
      routePath = routePath.trim().replace(/^\/+|\/+$/g, "").replace(/\.js$/i, "");

      // ─── Step 2: HTTP Method ───
      console.log("\nStep 2/7: Select HTTP Method:");
      console.log("   1. POST   (Create / Auth / Action)");
      console.log("   2. GET    (Fetch / Read)");
      console.log("   3. PUT    (Update)");
      console.log("   4. DELETE (Remove)");
      console.log("   5. ANY    (All HTTP Methods)");
      const methodChoice = await promptQuestion("Select HTTP Method (1-5)", "1");
      const methodMap = { "1": "post", "2": "get", "3": "put", "4": "delete", "5": "any" };
      const httpMethod = methodMap[methodChoice.trim()] || "post";

      // ─── Step 3: API Category ───
      console.log("\nStep 3/7: Select API Category:");
      console.log("   1. 🔑 Auth: Login API (Email/Username + Password validation, Bcrypt, Token)");
      console.log("   2. 📝 Auth: Register API (Validation, Password Hashing, DB Insert)");
      console.log("   3. 🔐 Auth: Forgot Password API (Email check, Reset Token, SMTP Mailer)");
      console.log("   4. 📦 Other Database API (CRUD Operations)");
      console.log("   5. ⚡ Custom Blank API Endpoint");

      const catChoice = await promptQuestion("Select Category (1-5)", "1");
      let templateType = "custom";
      let dbOperation = "";

      if (catChoice.trim() === "1") templateType = "auth_login";
      else if (catChoice.trim() === "2") templateType = "auth_register";
      else if (catChoice.trim() === "3") templateType = "auth_forgot";
      else if (catChoice.trim() === "4") {
        console.log("\n📋 Select Database Sub-Operation:");
        console.log("   1. 🔍 Fetch Single Record (Find by ID or column)");
        console.log("   2. 📖 Fetch All Records & Paginate");
        console.log("   3. ➕ Insert / Create Record");
        console.log("   4. ✏️ Update Record");
        console.log("   5. 🗑️ Delete Record");
        const opChoice = await promptQuestion("Select Sub-Operation (1-5)", "1");
        const opMap = { "1": "db_fetch", "2": "db_list", "3": "db_insert", "4": "db_update", "5": "db_delete" };
        templateType = opMap[opChoice.trim()] || "db_fetch";
      }

      // ─── Step 4: Database Connection & Introspection (Tables & Columns) ───
      let dbKey = "mysql";
      let tableName = "user";
      let targetColumns = ["id"];
      let dbDriver = "mysql";

      const configs = readDbConfig();
      const availableKeys = Object.keys(configs);

      if (templateType !== "custom" && availableKeys.length > 0) {
        let step4Resolved = false;
        while (!step4Resolved) {
          console.log("\nStep 4/7: Database Connection & Live Introspection");
          console.log("📌 Available Database Connections:");
          availableKeys.forEach((k, idx) => console.log(`   ${idx + 1}. [${k}] (${configs[k].driver || configs[k].DB_DRIVER || "mysql"})`));

          const keyChoice = await promptQuestion(`Select Database Connection # or Key`, availableKeys[0]);
          let selectedKey = availableKeys.find(k => k.toLowerCase() === keyChoice.trim().toLowerCase());
          const numKey = parseInt(keyChoice.trim());
          if (!selectedKey && !isNaN(numKey) && numKey >= 1 && numKey <= availableKeys.length) {
            selectedKey = availableKeys[numKey - 1];
          }
          dbKey = selectedKey || availableKeys[0];
          dbDriver = (configs[dbKey]?.driver || configs[dbKey]?.DB_DRIVER || "mysql").toLowerCase();

          // Connect & Fetch Live Tables
          try {
            const conf = configs[dbKey];
            const connObj = {
              host: conf.DB_HOST || "127.0.0.1",
              user: conf.DB_USER || "root",
              password: conf.DB_PASS || "",
              database: conf.DB_NAME || "",
              driver: dbDriver,
              url: conf.url || conf.DB_URL || conf.uri || null,
            };

            let testDriver;
            if (dbDriver === "postgres") {
              testDriver = (await import("../database/postgres.js")).default;
            } else if (dbDriver === "mongodb") {
              testDriver = (await import("../database/mongodb.js")).default;
            } else {
              testDriver = (await import("../database/mysql.js")).default;
            }

            const client = await testDriver.connect(connObj);
            let tables = [];

            if (dbDriver === "mongodb") {
              const rawTables = await client.listCollections().toArray();
              tables = rawTables.map(c => c.name).filter(n => !n.startsWith("system."));
            } else {
              const [rows] = await client.query("SHOW TABLES");
              tables = rows.map(r => Object.values(r)[0]);
            }

            if (tables.length > 0) {
              console.log(`\n📌 Live Tables found in database '${dbKey}':`);
              tables.forEach((t, idx) => console.log(`   ${idx + 1}. ${t}`));

              const tChoice = await promptQuestion("Select Table # or Name", tables[0]);
              const numT = parseInt(tChoice.trim());
              if (!isNaN(numT) && numT >= 1 && numT <= tables.length) {
                tableName = tables[numT - 1];
              } else if (tChoice.trim()) {
                tableName = tChoice.trim();
              } else {
                tableName = tables[0];
              }

              // Fetch Live Columns for selected table
              try {
                let columns = [];
                if (dbDriver === "mongodb") {
                  const sampleDoc = await client.collection(tableName).findOne();
                  if (sampleDoc) columns = Object.keys(sampleDoc);
                } else {
                  const [colRows] = await client.query(`SHOW COLUMNS FROM \`${tableName}\``);
                  columns = colRows.map(c => c.Field);
                }

                if (columns.length > 0) {
                  console.log(`\n📋 Live Columns found in table '${tableName}':`);
                  columns.forEach((c, idx) => console.log(`   ${idx + 1}. ${c}`));

                  const cChoice = await promptQuestion("Select Target Filter/ID Column(s) by # or Name (comma-separated, e.g. 1, 3 or id, status)", columns[0]);
                  const parts = cChoice.split(",").map(s => s.trim()).filter(Boolean);

                  targetColumns = parts.map(part => {
                    const numC = parseInt(part);
                    if (!isNaN(numC) && numC >= 1 && numC <= columns.length) {
                      return columns[numC - 1];
                    }
                    return part;
                  });

                  if (targetColumns.length === 0) targetColumns = [columns[0]];
                }
              } catch (e) {
                // Ignore column inspection error fallback
              }

            } else {
              tableName = await promptQuestion("Enter Database Table Name", "user");
            }
            step4Resolved = true;
          } catch (e) {
            console.log(`\n❌ Failed to connect to database '${dbKey}': ${e.message}`);
            console.log("👉 Options: [r] Retry / Select another DB connection | [m] Enter table & column names manually | [c] Cancel wizard");
            const errChoice = await promptQuestion("Select Option (r/m/c)", "r");
            const errAct = errChoice.trim().toLowerCase();

            if (errAct === "m" || errAct === "manual") {
              tableName = await promptQuestion("Enter Database Table Name", "user");
              const colInput = await promptQuestion("Enter Target Filter Column Name(s) (comma separated)", "id");
              targetColumns = colInput.split(",").map(s => s.trim()).filter(Boolean);
              if (targetColumns.length === 0) targetColumns = ["id"];
              step4Resolved = true;
            } else if (errAct === "c" || errAct === "cancel") {
              console.log("⏹ API creation cancelled due to database connection failure.");
              return;
            } else {
              // Retry loop
              continue;
            }
          }
        }
      }

      // ─── File Overwrite Protection ───
      const targetFile = path.join(apiRoutesDir(), `${routePath}.js`);
      if (fs.existsSync(targetFile)) {
        console.log(`\n⚠️  WARNING: API Route file already exists: .api_routes/${routePath}.js`);
        const confirmOverwrite = await promptQuestion("Overwrite and replace existing API route? (y/n)", "n");
        if (!["y", "yes"].includes(confirmOverwrite.trim().toLowerCase())) {
          console.log("⏹ API creation cancelled.");
          return;
        }
      }

      // ─── Code Templates Generator ───
      const buildCode = (type, pathStr, table, key, cols) => {
        const endpointName = path.basename(pathStr);
        const mainCol = cols[0] || "id";
        const whereClause = cols.map(c => `${c} = ?`).join(" AND ");

        if (type === "auth_login") {
          const valVars = cols.map(c => `const ${c}_val = req.body?.${c} || req.body?.username || req.body?.email;`).join("\n");
          const missingCheck = cols.map(c => `!${c}_val`).join(" || ");
          const queryWhere = cols.map(c => `${c} = ?`).join(" OR ");
          const queryParams = cols.map(c => `${c}_val`).join(", ");

          return `// Auto-Generated Vexora Auth Login API Route
// Target Table: '${table}' [Connection: ${key}] [Filter: ${queryWhere}]

const dbKey = "${key}";
${valVars}
const password = req.body?.password;

if ((${missingCheck}) || !password) {
  return Vexora.Response.error("Login credential (${cols.join(" / ")}) and Password are required!", 400);
}

try {
  // Fetch user record from database
  const user = await Vexora.fetch(dbKey, "SELECT * FROM ${table} WHERE ${queryWhere}", [${queryParams}]);
  if (!user) {
    return Vexora.Response.error("Invalid credentials! User not found.", 401);
  }

  // Verify password using Bcrypt
  const isValid = await Vexora.Bcrypt.compare(password, user.password || "");
  if (!isValid) {
    return Vexora.Response.error("Invalid credentials! Password incorrect.", 401);
  }

  // Generate Session Token
  const token = Vexora.TokenVault.create({ id: user.${mainCol} || user._id, email: user.email });

  delete user.password; // Hide password in response
  return Vexora.Response.success({ token, user }, "Login successful!");
} catch (err) {
  return Vexora.Response.error("Login failed: " + err.message, 500);
}
`;
        }

        if (type === "auth_register") {
          return `// Auto-Generated Vexora Auth Register API Route
// Target Table: '${table}' [Connection: ${key}]

const dbKey = "${key}";
const email = req.body?.email;
const password = req.body?.password;
const title = req.body?.title || req.body?.name || "New User";

if (!email || !password) {
  return Vexora.Response.error("Email and Password are required!", 400);
}

try {
  // Check if user already exists
  const existing = await Vexora.fetch(dbKey, "SELECT 1 FROM ${table} WHERE email = ?", [email]);
  if (existing) {
    return Vexora.Response.error("User with this email already exists!", 409);
  }

  // Hash password
  const hashedPassword = await Vexora.Bcrypt.hash(password);

  // Insert user record
  const newId = await Vexora.insert(dbKey, "${table}", {
    email: email,
    password: hashedPassword,
    title: title,
    status: "active"
  });

  return Vexora.Response.success({ id: newId, email, title }, "User registered successfully!", 201);
} catch (err) {
  return Vexora.Response.error("Registration failed: " + err.message, 500);
}
`;
        }

        if (type === "auth_forgot") {
          return `// Auto-Generated Vexora Auth Forgot Password API Route
// Target Table: '${table}' [Connection: ${key}]

const dbKey = "${key}";
const email = req.body?.email;

if (!email) {
  return Vexora.Response.error("Email address is required!", 400);
}

try {
  // Check if user exists
  const user = await Vexora.fetch(dbKey, "SELECT * FROM ${table} WHERE email = ?", [email]);
  if (!user) {
    return Vexora.Response.error("No account found with this email address!", 404);
  }

  // Generate 15-minute Reset Token
  const resetToken = Vexora.TokenVault.create({ id: user.${mainCol} || user._id, email: user.email }, "15m");

  // Send password reset email using Vexora MailSender
  await Vexora.MailSender.send({
    to: email,
    subject: "Password Reset Request",
    html: \`<p>Hello \${user.title || user.name || "User"},</p><p>Your password reset token is: <strong>\${resetToken}</strong></p>\`
  });

  return Vexora.Response.success({ email, sent: true }, "Password reset link/token sent to your email!");
} catch (err) {
  return Vexora.Response.error("Forgot password failed: " + err.message, 500);
}
`;
        }

        if (type === "db_fetch") {
          return `// Auto-Generated Vexora Fetch Single Record API
// Target Table: '${table}' [Connection: ${key}] [WHERE: ${whereClause}]

const dbKey = "${key}";
${cols.map(c => `const ${c}_val = req.query?.${c} || req.body?.${c} || 1;`).join("\n")}

try {
  const item = await Vexora.fetch(dbKey, "SELECT * FROM ${table} WHERE ${whereClause}", [${cols.map(c => `${c}_val`).join(", ")}]);
  if (!item) {
    return Vexora.Response.error("Record not found!", 404);
  }
  return Vexora.Response.success(item, "Record fetched successfully!");
} catch (err) {
  return Vexora.Response.error("Fetch failed: " + err.message, 500);
}
`;
        }

        if (type === "db_list") {
          return `// Auto-Generated Vexora List & Paginate API
// Target Table: '${table}' [Connection: ${key}]

const dbKey = "${key}";
const page = parseInt(req.query?.page) || 1;
const limit = parseInt(req.query?.limit) || 10;

try {
  const result = await Vexora.paginate(dbKey, "${table}", page, limit);
  return Vexora.Response.success(result, "Records listed successfully!");
} catch (err) {
  return Vexora.Response.error("List failed: " + err.message, 500);
}
`;
        }

        if (type === "db_insert") {
          return `// Auto-Generated Vexora Insert Record API
// Target Table: '${table}' [Connection: ${key}]

const dbKey = "${key}";
const data = req.body || {};

if (!data || Object.keys(data).length === 0) {
  return Vexora.Response.error("Request body cannot be empty!", 400);
}

try {
  const newId = await Vexora.insert(dbKey, "${table}", data);
  return Vexora.Response.success({ id: newId, ...data }, "Record created successfully!", 201);
} catch (err) {
  return Vexora.Response.error("Insert failed: " + err.message, 500);
}
`;
        }

        if (type === "db_update") {
          return `// Auto-Generated Vexora Update Record API
// Target Table: '${table}' [Connection: ${key}] [WHERE: ${whereClause}]

const dbKey = "${key}";
${cols.map(c => `const ${c}_val = req.body?.${c} || req.query?.${c};`).join("\n")}

if (${cols.map(c => `!${c}_val`).join(" || ")}) {
  return Vexora.Response.error("Required filter parameter(s) missing: ${cols.join(", ")}", 400);
}

const data = { ...req.body };
${cols.map(c => `delete data.${c};`).join("\n")}

try {
  const updatedCount = await Vexora.update(dbKey, "${table}", data, "${whereClause}", [${cols.map(c => `${c}_val`).join(", ")}]);
  return Vexora.Response.success({ updated: updatedCount, filters: { ${cols.map(c => `${c}: ${c}_val`).join(", ")} } }, "Record updated successfully!");
} catch (err) {
  return Vexora.Response.error("Update failed: " + err.message, 500);
}
`;
        }

        if (type === "db_delete") {
          return `// Auto-Generated Vexora Delete Record API
// Target Table: '${table}' [Connection: ${key}] [WHERE: ${whereClause}]

const dbKey = "${key}";
${cols.map(c => `const ${c}_val = req.body?.${c} || req.query?.${c};`).join("\n")}

if (${cols.map(c => `!${c}_val`).join(" || ")}) {
  return Vexora.Response.error("Required filter parameter(s) missing: ${cols.join(", ")}", 400);
}

try {
  const deletedCount = await Vexora.delete(dbKey, "${table}", "${whereClause}", [${cols.map(c => `${c}_val`).join(", ")}]);
  return Vexora.Response.success({ deleted: deletedCount, filters: { ${cols.map(c => `${c}: ${c}_val`).join(", ")} } }, "Record deleted successfully!");
} catch (err) {
  return Vexora.Response.error("Delete failed: " + err.message, 500);
}
`;
        }

        // Custom Blank
        return `// Auto-Generated Custom Vexora API Endpoint: ${endpointName}

try {
  const payload = req.body || req.query;
  return Vexora.Response.success({ received: payload }, "API endpoint executed successfully!");
} catch (err) {
  return Vexora.Response.error("API error: " + err.message, 500);
}
`;
      };

      let codeContent = buildCode(templateType, routePath, tableName, dbKey, targetColumns);

      // ─── Step 5: Code Preview & VS Code Live Editing Loop ───
      while (true) {
        line();
        console.log(`Step 5/7: 📋 API SPECIFICATION SUMMARY`);
        line();
        console.log(`  • Route Path     : /api/${routePath}`);
        console.log(`  • HTTP Method    : ${httpMethod.toUpperCase()}`);
        console.log(`  • API Type       : ${templateType.toUpperCase()}`);
        console.log(`  • DB Connection  : ${dbKey} (${dbDriver})`);
        console.log(`  • Target Table   : ${tableName}`);
        console.log(`  • WHERE Columns  : ${targetColumns.join(" AND ")}`);
        console.log(`  • File Location  : .api_routes/${routePath}.js`);
        line();

        console.log("👉 Options: [s] Save & Create API | [v] View Code | [e] Edit in VS Code | [b] Back / Change Specs | [c] Cancel");
        const actionChoice = await promptQuestion("Select Action (s/v/e/b/c)", "s");
        const act = actionChoice.trim().toLowerCase();

        if (act === "s" || act === "save" || act === "y") {
          break; // proceed to save
        } else if (act === "v" || act === "view") {
          line();
          console.log(`📐 FULL API CODE [.api_routes/${routePath}.js]`);
          line();
          console.log(codeContent);
          line();
          await promptQuestion("Press Enter to return to options...", "");
        } else if (act === "e" || act === "edit") {
          const draftPath = path.join(rootDir(), ".vexora_config", "temp_api_draft.js");
          ensureDir(path.dirname(draftPath));
          fs.writeFileSync(draftPath, codeContent, "utf8");

          console.log(`\n📝 Opening draft code in VS Code (${draftPath})...`);
          try {
            execSync(`code "${draftPath}"`, { stdio: "ignore" });
            console.log("👉 VS Code opened! Edit the file, SAVE IT in VS Code, then press Enter below.");
          } catch {
            console.log(`👉 File saved at: ${draftPath}. Edit it, SAVE IT, then press Enter below.`);
          }

          await promptQuestion("Press Enter after saving your edits in VS Code...", "");
          if (fs.existsSync(draftPath)) {
            codeContent = fs.readFileSync(draftPath, "utf8");
            try { fs.unlinkSync(draftPath); } catch {}
            console.log("✅ Updated code loaded from VS Code edits!");
          }
        } else if (act === "b" || act === "back") {
          console.log("\n🔄 What would you like to change?");
          console.log("   1. 📋 Target Column(s) / Table / DB Connection (Step 4)");
          console.log("   2. 🌐 Route Path");
          console.log("   3. ⚡ HTTP Method");
          console.log("   4. 🔑 API Category");

          const changeChoice = await promptQuestion("Select Option (1-4)", "1");
          const choiceStr = changeChoice.trim();

          if (choiceStr === "1") {
            // Re-run Step 4 DB & Column Selection
            try {
              const conf = configs[dbKey];
              const connObj = {
                host: conf?.DB_HOST || "127.0.0.1",
                user: conf?.DB_USER || "root",
                password: conf?.DB_PASS || "",
                database: conf?.DB_NAME || "",
                driver: dbDriver,
                url: conf?.url || conf?.DB_URL || conf?.uri || null,
              };

              let testDriver;
              if (dbDriver === "postgres") {
                testDriver = (await import("../database/postgres.js")).default;
              } else if (dbDriver === "mongodb") {
                testDriver = (await import("../database/mongodb.js")).default;
              } else {
                testDriver = (await import("../database/mysql.js")).default;
              }

              const client = await testDriver.connect(connObj);
              let columns = [];
              if (dbDriver === "mongodb") {
                const sampleDoc = await client.collection(tableName).findOne();
                if (sampleDoc) columns = Object.keys(sampleDoc);
              } else {
                const [colRows] = await client.query(`SHOW COLUMNS FROM \`${tableName}\``);
                columns = colRows.map(c => c.Field);
              }

              if (columns.length > 0) {
                console.log(`\n📋 Live Columns found in table '${tableName}':`);
                columns.forEach((c, idx) => console.log(`   ${idx + 1}. ${c}`));

                const cChoice = await promptQuestion("Select Target Filter/ID Column(s) by # or Name (comma-separated)", columns[0]);
                const parts = cChoice.split(",").map(s => s.trim()).filter(Boolean);

                targetColumns = parts.map(part => {
                  const numC = parseInt(part);
                  if (!isNaN(numC) && numC >= 1 && numC <= columns.length) {
                    return columns[numC - 1];
                  }
                  return part;
                });

                if (targetColumns.length === 0) targetColumns = [columns[0]];
              }
            } catch (e) {
              const colInput = await promptQuestion("Enter Target Filter Column Name(s) (comma separated)", "id");
              targetColumns = colInput.split(",").map(s => s.trim()).filter(Boolean);
              if (targetColumns.length === 0) targetColumns = ["id"];
            }
          } else if (choiceStr === "2") {
            routePath = await promptQuestion("Enter New API Route Path", routePath);
            routePath = routePath.trim().replace(/^\/+|\/+$/g, "").replace(/\.js$/i, "");
          } else if (choiceStr === "3") {
            console.log("\nSelect HTTP Method: 1. POST | 2. GET | 3. PUT | 4. DELETE | 5. ANY");
            const mChoice = await promptQuestion("Select Method (1-5)", "1");
            const mMap = { "1": "post", "2": "get", "3": "put", "4": "delete", "5": "any" };
            httpMethod = mMap[mChoice.trim()] || "post";
          } else if (choiceStr === "4") {
            console.log("\nSelect API Category: 1. Auth Login | 2. Auth Register | 3. Auth Forgot | 4. Other CRUD | 5. Custom Blank");
            const catChoice2 = await promptQuestion("Select Category (1-5)", "1");
            if (catChoice2.trim() === "1") templateType = "auth_login";
            else if (catChoice2.trim() === "2") templateType = "auth_register";
            else if (catChoice2.trim() === "3") templateType = "auth_forgot";
            else if (catChoice2.trim() === "4") templateType = "db_fetch";
            else templateType = "custom";
          }

          codeContent = buildCode(templateType, routePath, tableName, dbKey, targetColumns);
          console.log("✅ API Specifications updated!");
          continue;
        } else {
          console.log("⏹ API creation cancelled.");
          return;
        }
      }

      // ─── Step 6: Save API File & Auto-Register Whitelist ───
      const targetDir = path.dirname(targetFile);
      ensureDir(targetDir);
      fs.writeFileSync(targetFile, codeContent, "utf8");

      const whitelistFile = path.join(targetDir, "api.whitelist.js");
      const endpointName = path.basename(routePath);

      if (!fs.existsSync(whitelistFile)) {
        const whitelistContent = `import Vexora from "vexora";

const apiRouter = new Vexora.RouteController();

// Registered API Endpoints
apiRouter.${httpMethod}('${endpointName}');

apiRouter.any('/:any', (req, res) => {
  return res.json({ status: false, message: "Action not found!" }, 404);
});

export default apiRouter;
`;
        fs.writeFileSync(whitelistFile, whitelistContent, "utf8");
      } else {
        let wlCode = fs.readFileSync(whitelistFile, "utf8");
        if (!wlCode.includes(`'${endpointName}'`) && !wlCode.includes(`"${endpointName}"`)) {
          wlCode = wlCode.replace(/(apiRouter\.[a-z]+\('[^']+'\);?)/i, `$1\napiRouter.${httpMethod}('${endpointName}');`);
          fs.writeFileSync(whitelistFile, wlCode, "utf8");
        }
      }

      line();
      console.log(`🎉 Step 6/7: API Route successfully created & registered!`);
      console.log(`  📄 File:      .api_routes/${routePath}.js`);
      console.log(`  🌐 Endpoint:  /api/${routePath}  [${httpMethod.toUpperCase()}]`);
      console.log(`  📋 Whitelist: .api_routes/${path.dirname(routePath)}/api.whitelist.js`);
      line();

      // ─── Step 7: Instant Live API Test Prompt ───
      const testAns = await promptQuestion("Step 7/7: 🧪 Would you like to TEST this new API endpoint live right now? (y/n)", "n");
      if (testAns.trim().toLowerCase() === "y" || testAns.trim().toLowerCase() === "yes") {
        console.log(`\n⚡ Testing Endpoint: /api/${routePath}...`);
        try {
          const Vexora = (await import("../Vexora.js")).default;
          let testRes;
          const url = `http://localhost:3000/api/${routePath}`;

          if (httpMethod === "get") {
            testRes = await Vexora.http.get(url);
          } else if (httpMethod === "post") {
            testRes = await Vexora.http.post(url, { test: true });
          } else if (httpMethod === "put") {
            testRes = await Vexora.http.put(url, { test: true });
          } else {
            testRes = await Vexora.http.delete(url);
          }

          line();
          console.log(`🧪 LIVE API TEST RESULT [Status: ${testRes.status || 200}]`);
          line();
          console.log(JSON.stringify(testRes.data || testRes, null, 2));
          line();
        } catch (err) {
          console.log(`⚠️ Live Test Notice: Ensure Vexora server is running ('node index.js'). Error: ${err.message}`);
        }
      }
    }
  },

  "make:route": {
    description: "Creates a new API route folder with api.whitelist.js",
    usage: "make:route <name>",
    category: "📌 Routes",
    aliases: ["make:api"],
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a route name.");
        console.error("   Usage: vexora make:route <name>");
        return;
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
        return;
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
        console.error("   Usage: vexora remove:route <name>");
        return;
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
