/**
 * Vexora Framework - Generator Commands
 * Covers ALL framework features for full CLI scaffolding
 */

import fs from "node:fs";
import path from "node:path";
import { rootDir, middlewareDir, queueDir, controllersDir, ensureDir } from "./helpers.js";

export const generatorCommands = {
  // ─── Server & App ──────────────────────────────────────
  "make:server": {
    description: "Generates a complete server.js starter script",
    usage: "make:server <name>",
    category: "⚙️ Generators",
    aliases: ["make:app"],
    async run(args) {
      const name = args[1] ? args[1].trim() : "";
      if (!name) {
        console.error("❌ Please provide a server file name.");
        console.error("   Usage: node Vexora make:server <name>");
        console.error("   Example: node Vexora make:server server");
        process.exit(1);
      }
      const targetName = name.endsWith(".js") ? name : `${name}.js`;
      const file = path.join(rootDir(), targetName);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: ${targetName} already exists! Skipping.`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

// Start the Vexora server on port 3000
// This auto-connects API controllers, static serving, and security middleware
const app = Vexora.start(3000);
`, "utf8");
      console.log(`✅ Created ${targetName} successfully!`);
      console.log(`👉 Run 'node ${targetName}' to start your server.`);
    },
  },

  // ─── WebSocket ─────────────────────────────────────────
  "make:websocket": {
    description: "Generates a WebSocket server module",
    usage: "make:websocket [name]",
    category: "⚙️ Generators",
    aliases: ["make:ws"],
    async run(args) {
      const wsName = (args[1] || "chat").trim();
      const wsDir = path.join(rootDir(), "websockets");
      ensureDir(wsDir);
      const file = path.join(wsDir, `${wsName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: websockets/${wsName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

/**
 * Vexora WebSocket Module - ${wsName}
 */
export function initWebSocket(app) {
    const io = Vexora.WebSocket(app);

    io.on("connection", (socket) => {
        console.log("⚡ Client connected:", socket.id);

        socket.on("message", (data) => {
            console.log("📩 Received:", data);
            // Echo back
            socket.send({ echo: data, timestamp: Date.now() });
            // Broadcast to all
            io.broadcast({ from: socket.id, data });
        });

        socket.on("disconnect", () => {
            console.log("🔌 Client disconnected:", socket.id);
        });
    });

    return io;
}

export default initWebSocket;
`, "utf8");
      console.log(`✅ Created websockets/${wsName}.js successfully!`);
      console.log(`👉 Import & call initWebSocket(app) in your server.js`);
    },
  },

  // ─── Cron / Scheduler ──────────────────────────────────
  "make:cron": {
    description: "Generates a Cron Scheduler task script",
    usage: "make:cron <name>",
    category: "⚙️ Generators",
    aliases: ["make:schedule"],
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a cron task name.");
        console.error("   Usage: node Vexora make:cron <name>");
        process.exit(1);
      }
      const cronName = name.trim();
      const cronDir = path.join(rootDir(), "cron");
      ensureDir(cronDir);
      const file = path.join(cronDir, `${cronName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: cron/${cronName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

/**
 * Vexora Cron Task - ${cronName}
 * Standard 5-field cron: minute hour day-of-month month day-of-week
 */

// Runs every 5 minutes
Vexora.Schedule("*/5 * * * *", async () => {
    console.log("⏰ Cron [${cronName}]:", new Date().toISOString());
    // TODO: Implement cron task logic
});
`, "utf8");
      console.log(`✅ Created cron/${cronName}.js successfully!`);
    },
  },

  // ─── Auth Controller ───────────────────────────────────
  "make:auth": {
    description: "Generates Token Vault Auth (login/register)",
    category: "⚙️ Generators",
    async run() {
      ensureDir(controllersDir());
      const file = path.join(controllersDir(), "auth.js");

      if (fs.existsSync(file)) {
        console.warn("⚠️ Warning: controllers/auth.js already exists!");
        process.exit(0);
      }

      fs.writeFileSync(file, `// controllers/auth.js
// Pre-injected: Vexora, req, res, db, params

if (req.method === "POST") {
    const { action, email, password } = req.body || {};

    if (action === "register") {
        const hash = Vexora.Helper.hashPassword(password || "");
        const userId = await Vexora.insert("auth", "users", {
            email, password: hash, status: "active"
        });
        return res.success({ userId }, "Registered!");
    }

    if (action === "login") {
        const user = await Vexora.fetch("auth", "SELECT * FROM users WHERE email = ?", [email]);
        if (!user || !Vexora.Helper.verifyPassword(password, user.password)) {
            return res.error("Invalid credentials", 401);
        }
        const token = Vexora.TokenVault.seal({ id: user.id, email, role: "user" }, "APP_SECRET", 3600);
        return res.success({ token }, "Login successful!");
    }
}

return res.error("Invalid action", 400);
`, "utf8");
      console.log("✅ Created controllers/auth.js successfully!");
    },
  },

  // ─── SMTP Mailer ───────────────────────────────────────
  "make:mailer": {
    description: "Generates SMTP email sending module",
    usage: "make:mailer [name]",
    category: "⚙️ Generators",
    aliases: ["make:mail", "make:smtp"],
    async run(args) {
      const mailerName = (args[1] || "mailer").trim();
      const mailDir = path.join(rootDir(), "mail");
      ensureDir(mailDir);
      const file = path.join(mailDir, `${mailerName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: mail/${mailerName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

/**
 * Vexora SMTP Mailer - ${mailerName}
 * Configure SMTP in .vexora_config/config:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=ssl
 *   SMTP_USER=your@email.com
 *   SMTP_PASS=your_app_password
 *   FROM_NAME=Vexora App
 *   FROM_EMAIL=your@email.com
 */

export async function sendWelcomeEmail(toEmail, userName) {
    return await Vexora.mail.send({
        to: toEmail,
        subject: "Welcome to Our Platform!",
        html: \`
            <h1>Hello \${userName}!</h1>
            <p>Welcome aboard. Your account has been created successfully.</p>
            <p>— The Vexora Team</p>
        \`
    });
}

export async function sendOTP(toEmail, otp) {
    return await Vexora.mail.send({
        to: toEmail,
        subject: "Your OTP Code",
        html: \`<h2>Your verification code: <strong>\${otp}</strong></h2><p>Valid for 10 minutes.</p>\`
    });
}

export default { sendWelcomeEmail, sendOTP };
`, "utf8");
      console.log(`✅ Created mail/${mailerName}.js successfully!`);
    },
  },

  // ─── HTTP Client ───────────────────────────────────────
  "make:http": {
    description: "Generates HTTP client API wrapper module",
    usage: "make:http [name]",
    category: "⚙️ Generators",
    aliases: ["make:api-client"],
    async run(args) {
      const clientName = (args[1] || "apiClient").trim();
      const servicesDir = path.join(rootDir(), "services");
      ensureDir(servicesDir);
      const file = path.join(servicesDir, `${clientName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: services/${clientName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

/**
 * Vexora HTTP Client Service - ${clientName}
 * Built-in HTTP client (zero dependencies)
 */

const BASE_URL = "https://api.example.com";

export async function fetchUsers() {
    const res = await Vexora.http.get(\`\${BASE_URL}/users\`);
    return res.data;
}

export async function createUser(userData) {
    const res = await Vexora.http.post(\`\${BASE_URL}/users\`, {
        body: userData,
        headers: { "Content-Type": "application/json" }
    });
    return res.data;
}

export async function updateUser(id, userData) {
    const res = await Vexora.http.put(\`\${BASE_URL}/users/\${id}\`, {
        body: userData,
        headers: { "Content-Type": "application/json" }
    });
    return res.data;
}

export async function deleteUser(id) {
    const res = await Vexora.http.delete(\`\${BASE_URL}/users/\${id}\`);
    return res.data;
}

export default { fetchUsers, createUser, updateUser, deleteUser };
`, "utf8");
      console.log(`✅ Created services/${clientName}.js successfully!`);
    },
  },

  // ─── File Upload / Storage ─────────────────────────────
  "make:upload": {
    description: "Generates encrypted file upload handler",
    usage: "make:upload [name]",
    category: "⚙️ Generators",
    aliases: ["make:storage"],
    async run(args) {
      const uploadName = (args[1] || "upload").trim();
      ensureDir(controllersDir());
      const file = path.join(controllersDir(), `${uploadName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: controllers/${uploadName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `// controllers/${uploadName}.js
// Pre-injected: Vexora, req, res, db, params

/**
 * File Upload Handler with AES-256-CBC Encryption
 * POST /${uploadName} — Upload a file
 * GET  /${uploadName}?file=<path>&key=<key> — Download & decrypt
 */

if (req.method === "POST") {
    // Create a secure upload token
    const token = Vexora.Storage.createToken({
        allowedRoots: ["public", "MyDrive"],
        maxSizeMB: 5,
        allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"]
    });

    // Handle upload
    const result = await Vexora.Storage.handle(req, req.file, token, {
        encrypt: true,
        subDir: "uploads"
    });

    return res.success(result, "File uploaded successfully!");
}

if (req.method === "GET" && req.query.file && req.query.key) {
    const decrypted = Vexora.Storage.decrypt(
        require("fs").readFileSync(req.query.file),
        req.query.key
    );
    res.setHeader("Content-Type", "application/octet-stream");
    return res.end(decrypted);
}

return res.json({ endpoints: ["POST /${uploadName}", "GET /${uploadName}?file=<path>&key=<key>"] });
`, "utf8");
      console.log(`✅ Created controllers/${uploadName}.js successfully!`);
    },
  },

  // ─── CSRF Protection ──────────────────────────────────
  "make:csrf": {
    description: "Generates CSRF-protected form controller",
    category: "⚙️ Generators",
    async run() {
      ensureDir(controllersDir());
      const file = path.join(controllersDir(), "csrf_form.js");

      if (fs.existsSync(file)) {
        console.warn("⚠️ Warning: controllers/csrf_form.js already exists!");
        process.exit(0);
      }

      fs.writeFileSync(file, `// controllers/csrf_form.js
// Pre-injected: Vexora, req, res, db, params

/**
 * CSRF Protected Form Example
 */

if (req.method === "GET") {
    // Generate CSRF token
    const csrfToken = Vexora.csrf.generate();
    return res.success({ csrf_token: csrfToken }, "Use this token in your POST request");
}

if (req.method === "POST") {
    const { csrf_token } = req.body || {};

    // Verify CSRF token (timing-safe comparison)
    if (!Vexora.csrf.verify(csrf_token)) {
        return res.error("CSRF token verification failed!", 403);
    }

    return res.success({ validated: true }, "CSRF token verified successfully!");
}

return res.error("Method not allowed", 405);
`, "utf8");
      console.log("✅ Created controllers/csrf_form.js successfully!");
    },
  },

  // ─── Error Pages ───────────────────────────────────────
  "make:error-page": {
    description: "Generates custom HTML error pages (404, 500)",
    category: "⚙️ Generators",
    aliases: ["make:errors"],
    async run() {
      const errorDir = path.join(rootDir(), ".vexora_error_page");
      ensureDir(errorDir);

      const page404 = path.join(errorDir, "404.html");
      if (!fs.existsSync(page404)) {
        fs.writeFileSync(page404, `<!DOCTYPE html>
<html><head><title>404 - Not Found</title>
<style>
  body { font-family: system-ui; background: #0f0f23; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
  .box { text-align: center; }
  h1 { font-size: 6rem; margin: 0; background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: #94a3b8; font-size: 1.2rem; }
  a { color: #8b5cf6; text-decoration: none; }
</style></head>
<body><div class="box"><h1>404</h1><p>Page not found</p><a href="/">← Back to Home</a></div></body></html>
`, "utf8");
      }

      const page500 = path.join(errorDir, "500.html");
      if (!fs.existsSync(page500)) {
        fs.writeFileSync(page500, `<!DOCTYPE html>
<html><head><title>500 - Server Error</title>
<style>
  body { font-family: system-ui; background: #0f0f23; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
  .box { text-align: center; }
  h1 { font-size: 6rem; margin: 0; background: linear-gradient(135deg, #ef4444, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: #94a3b8; font-size: 1.2rem; }
</style></head>
<body><div class="box"><h1>500</h1><p>Internal Server Error</p></div></body></html>
`, "utf8");
      }

      console.log("✅ Created .vexora_error_page/404.html & 500.html successfully!");
    },
  },

  // ─── Middleware ─────────────────────────────────────────
  "make:middleware": {
    description: "Generates a new Middleware script",
    usage: "make:middleware <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a middleware name.");
        console.error("   Usage: node Vexora make:middleware <name>");
        process.exit(1);
      }
      const mwName = name.trim();
      ensureDir(middlewareDir());
      const file = path.join(middlewareDir(), `${mwName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: Middleware/${mwName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `/**
 * Vexora Middleware - ${mwName}
 */
export default async function ${mwName}(req, res, next) {
    // TODO: Implement middleware logic
    if (typeof next === "function") await next();
}
`, "utf8");
      console.log(`✅ Created Middleware/${mwName}.js successfully!`);
    },
  },

  "remove:middleware": {
    description: "Removes a Middleware script",
    usage: "remove:middleware <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a middleware name to remove.");
        console.error("   Usage: node Vexora remove:middleware <name>");
        process.exit(1);
      }
      const mwName = name.trim();
      const file = path.join(middlewareDir(), `${mwName}.js`);

      if (!fs.existsSync(file)) {
        console.warn(`⚠️ Middleware/${mwName}.js does not exist.`);
        process.exit(0);
      }

      fs.unlinkSync(file);
      console.log(`✅ Removed Middleware/${mwName}.js successfully!`);
    },
  },

  // ─── Queue Job ─────────────────────────────────────────
  "make:job": {
    description: "Generates a new Queue Job worker script",
    usage: "make:job <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a job name.");
        console.error("   Usage: node Vexora make:job <name>");
        process.exit(1);
      }
      const jobName = name.trim();
      ensureDir(queueDir());
      const file = path.join(queueDir(), `${jobName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: queue/${jobName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

/**
 * Vexora Queue Job - ${jobName}
 */
Vexora.Queue.define("${jobName}", async (jobData) => {
    console.log("Processing Job ${jobName}:", jobData);
    // TODO: Implement job logic
});
`, "utf8");
      console.log(`✅ Created queue/${jobName}.js successfully!`);
    },
  },

  // ─── Database Model ────────────────────────────────────
  "make:model": {
    description: "Generates a new Database Model script",
    usage: "make:model <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a model name.");
        console.error("   Usage: node Vexora make:model <name>");
        process.exit(1);
      }
      const modelName = name.trim();
      const dbDir = path.join(rootDir(), "database");
      ensureDir(dbDir);
      const file = path.join(dbDir, `${modelName}.js`);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: database/${modelName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `import Vexora from "vexora";

/**
 * Vexora Database Model - ${modelName}
 */
export class ${modelName} {
    static table = "${modelName.toLowerCase()}s";

    static async all() {
        return await Vexora.fetchAll(this.table);
    }

    static async find(id) {
        return await Vexora.fetch(this.table, { id });
    }

    static async create(data) {
        return await Vexora.insert("auth", this.table, data);
    }

    static async update(id, data) {
        return await Vexora.update("auth", this.table, data, "id = ?", [id]);
    }

    static async delete(id) {
        return await Vexora.delete("auth", this.table, "id = ?", [id]);
    }

    static async paginate(page = 1, perPage = 10) {
        return await Vexora.paginate("auth", \`SELECT * FROM \${this.table}\`, [], page, perPage);
    }
}

export default ${modelName};
`, "utf8");
      console.log(`✅ Created database/${modelName}.js successfully!`);
    },
  },

  "remove:model": {
    description: "Removes a Database Model script",
    usage: "remove:model <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a model name to remove.");
        console.error("   Usage: node Vexora remove:model <name>");
        process.exit(1);
      }
      const modelName = name.trim();
      const file = path.join(rootDir(), "database", `${modelName}.js`);

      if (!fs.existsSync(file)) {
        console.warn(`⚠️ database/${modelName}.js does not exist.`);
        process.exit(0);
      }

      fs.unlinkSync(file);
      console.log(`✅ Removed database/${modelName}.js successfully!`);
    },
  },

  // ─── Controller ────────────────────────────────────────
  "make:controller": {
    description: "Generates a new dynamic controller script",
    usage: "make:controller <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a controller name.");
        console.error("   Usage: node Vexora make:controller <name>");
        process.exit(1);
      }
      const controllerName = name.trim();
      ensureDir(controllersDir());
      const file = path.join(controllersDir(), `${controllerName}.js`);
      const parentDir = path.dirname(file);
      ensureDir(parentDir);

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: controllers/${controllerName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `// controllers/${controllerName}.js
// Pre-injected: Vexora, req, res, db, params

/**
 * Dynamic Controller - ${controllerName}
 * Access: GET/POST http://localhost:3000/${controllerName}
 */

if (req.method === "GET") {
    return Vexora.Response.success({
        controller: "${controllerName}",
        timestamp: Date.now()
    }, "Hello from ${controllerName} controller!");
}

if (req.method === "POST") {
    const body = req.body || {};
    return Vexora.Response.success({ received: body }, "Data received!");
}

return Vexora.Response.error("Method not allowed", 405);
`, "utf8");
      console.log(`✅ Created controllers/${controllerName}.js successfully!`);
    },
  },

  "remove:controller": {
    description: "Removes a dynamic controller script",
    usage: "remove:controller <name>",
    category: "⚙️ Generators",
    async run(args) {
      const name = args[1];
      if (!name) {
        console.error("❌ Please provide a controller name to remove.");
        console.error("   Usage: node Vexora remove:controller <name>");
        process.exit(1);
      }
      const controllerName = name.trim();
      const file = path.join(controllersDir(), `${controllerName}.js`);

      if (!fs.existsSync(file)) {
        console.warn(`⚠️ controllers/${controllerName}.js does not exist.`);
        process.exit(0);
      }

      fs.unlinkSync(file);
      console.log(`✅ Removed controllers/${controllerName}.js successfully!`);
    },
  }
};
