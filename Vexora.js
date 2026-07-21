/**
 * ==========================================================
 * Vexora Framework
 * ==========================================================
 *
 * @author      Satyam Kumar
 * @email       satyam.ku9725@gmail.com
 * @phone       +91 9725399936
 * @github      https://github.com/Satyam9725
 *
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 * up to date
 * 1.2.2
 * ==========================================================
 */

import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import cluster from "node:cluster";
const vexoraStart = performance.now();

import Init from "./utils/init.js";
import Config from "./core/config.js";
import Database from "./database/Database.js";

import originalServer from "./http/server.js";
import Http from "./http/index.js";
import { log as auditLog } from "./Middleware/audit_logger.js";
import Guard from "./core/Guard.js";
import SessionManager from "./session/SessionManager.js";
import { requestContext } from "./core/Context.js";
import TokenVault from "./security/TokenVault.js";
import IpTracker from "./security/IpTracker.js";
import RateLimiter, { RateLimiterClass } from "./security/RateLimiter.js";
import Request from "./http/Request.js";
import GlobalResponse from "./http/GlobalResponse.js";
import Validator from "./utils/Validator.js";
import initWebSocket from "./websocket/WebSocketServer.js";
import MemoryCache from "./cache/MemoryCache.js";
import CorsMiddleware from "./api_controller/CorsMiddleware.js";
import CsrfMiddleware from "./api_controller/CsrfMiddleware.js";
import createRouter, { Router } from "./http/Router.js";
import RouteController from "./api_controller/RouteController.js";
import ApiController from "./api_controller/ApiController.js";
import { setupGlobalErrorHandlers } from "./core/ErrorHandler.js";
import Helper from "./utils/Helper.js";
import StaticMiddleware from "./api_controller/StaticMiddleware.js";
import MailSender from "./mail/index.js";
import BehaviorAnalyzer from "./security/BehaviorAnalyzer.js";
import Recaptcha from "./security/recaptcha/index.js";
import Queue from "./queue/Queue.js";
import QueueWorker from "./queue/QueueWorker.js";
import Scheduler from "./scheduler/Scheduler.js";
import FileStorageService from "./storage/FileStorageService.js";

const suspiciousTracker = new Map(); // ip -> { timestamps: number[], head: number }

// Periodically clean up old tracker records to prevent memory leaks
const trackerInterval = setInterval(() => {
  const now = Date.now();
  const windowMs = (parseInt(Config.get("SUSPICIOUS_WINDOW")) || 60) * 1000;
  const cutoff = now - windowMs;

  for (const [ip, record] of suspiciousTracker.entries()) {
    while (record.head < record.timestamps.length && record.timestamps[record.head] <= cutoff) {
      record.head++;
    }
    if (record.head >= record.timestamps.length) {
      suspiciousTracker.delete(ip);
    } else if (record.head > 0) {
      record.timestamps = record.timestamps.slice(record.head);
      record.head = 0;
    }
  }
}, 60000);
if (trackerInterval && typeof trackerInterval.unref === "function") {
  trackerInterval.unref();
}

let cachedBlockedIpsStr = null;
let cachedBlockedIpsSet = new Set();

function getBlockedIpsSet() {
  const str = Config.get("BLOCKED_IPS") || "";
  if (str !== cachedBlockedIpsStr) {
    cachedBlockedIpsStr = str;
    cachedBlockedIpsSet = new Set(str ? str.split(",").map(ip => ip.trim()).filter(Boolean) : []);
  }
  return cachedBlockedIpsSet;
}

const serveForbidden = (req, res, message) => {
  const accept = req.headers['accept'] || '';
  const isHtml = accept.includes('text/html');
  let customErrorHtml = null;
  if (isHtml) {
    try {
      const root = process.cwd();
      const paths = [
        path.join(root, '.Vexora_error', '403.html'),
        path.join(root, '.vexora_error', '403.html')
      ];
      for (const p of paths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          customErrorHtml = fs.readFileSync(p, 'utf8');
          break;
        }
      }
    } catch (e) { }
  }

  if (customErrorHtml !== null) {
    res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
    res.end(customErrorHtml);
  } else {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: false, message }));
  }
};

const Server = (callback, options) => {
  if (Config.boolean("QUEUE_AUTO_START", true)) {
    QueueWorker.start();
  }
  if (Config.boolean("CRON_AUTO_START", true)) {
    Scheduler.start();
  }
  return originalServer(async (req, res) => {
    const clientIp = Helper.getClientIp(req);
    const publicExists = fs.existsSync(path.join(process.cwd(), "public"));

    // Run security shields globally regardless of public folder existence
    const blockedIps = getBlockedIpsSet();
    if (blockedIps.has(clientIp)) {
      serveForbidden(req, res, "Forbidden: Access Denied");
      return;
    }

    // 2. Temporary Cache Block Check
    if (MemoryCache.has("temp_blocked_ip:" + clientIp)) {
      serveForbidden(req, res, "Forbidden: Temporarily blocked due to suspicious activity");
      return;
    }

    // 3. Automated Advanced Behavior Analysis (Bot detection & user regularity)
    const analysis = BehaviorAnalyzer.analyze(req, clientIp);
    if (analysis.blocked) {
      const autoBlockDuration = parseInt(Config.get("AUTO_BLOCK_DURATION")) || 300;
      MemoryCache.set("temp_blocked_ip:" + clientIp, true, autoBlockDuration);
      console.warn(`⚠️ Blocked IP ${clientIp} for ${autoBlockDuration}s: ${analysis.reason}`);
      serveForbidden(req, res, "Forbidden: Temporarily blocked due to suspicious activity");
      return;
    }

    // Track response status codes (e.g. consecutive 404 route fuzzing)
    res.on("finish", () => {
      BehaviorAnalyzer.trackResponse(clientIp, res.statusCode);
    });

    // 4. Track and Monitor Behavior for Suspicious Activity (rate based)
    const now = Date.now();
    const suspiciousWindow = parseInt(Config.get("SUSPICIOUS_WINDOW")) || 60;
    const suspiciousThreshold = parseInt(Config.get("SUSPICIOUS_THRESHOLD")) || 30;
    const autoBlockDuration = parseInt(Config.get("AUTO_BLOCK_DURATION")) || 300;
    const cutoff = now - (suspiciousWindow * 1000);

    let record = suspiciousTracker.get(clientIp);
    if (!record) {
      record = { timestamps: [], head: 0 };
      suspiciousTracker.set(clientIp, record);
    }

    const timestamps = record.timestamps;
    while (record.head < timestamps.length && timestamps[record.head] <= cutoff) {
      record.head++;
    }

    if (record.head > 32 && record.head > (timestamps.length >> 1)) {
      record.timestamps = timestamps.slice(record.head);
      record.head = 0;
    }

    timestamps.push(now);
    const activeCount = timestamps.length - record.head;

    if (activeCount > suspiciousThreshold) {
      // Exceeded threshold -> Temporary Block in Memory Cache (Redis Mock)
      MemoryCache.set("temp_blocked_ip:" + clientIp, true, autoBlockDuration);
      suspiciousTracker.delete(clientIp);

      console.warn(`⚠️ Suspicious activity detected from IP ${clientIp}: ${activeCount} requests in ${suspiciousWindow}s. Auto-blocking for ${autoBlockDuration}s.`);

      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: false, message: "Forbidden: Temporarily blocked due to suspicious activity" }));
      return;
    }

    return callback(req, res);
  }, options);
};

setupGlobalErrorHandlers();

process.on("warning", (warning) => {
  auditLog("WARNING", "SYSTEM_WARNING", warning.message, {
    name: warning.name
  });
});

// Framework Initialize
Init.setup();

// Load Configuration
Config.load();

const csrfHandler = CsrfMiddleware.handle;
csrfHandler.configure = CsrfMiddleware.configure;
csrfHandler.rotate = CsrfMiddleware.rotate;
csrfHandler.generate = CsrfMiddleware.generate;
csrfHandler.verify = CsrfMiddleware.verify;

const initTime = (performance.now() - vexoraStart).toFixed(2);
if (!cluster.isWorker) {
  console.log(`⚡ Vexora Engine v1.0.4 Initialized in ${initTime}ms.`);
}

const Vexora = {
  protect: Guard.protect,
  session: SessionManager,
  TokenVault: TokenVault,
  IpTracker: IpTracker,
  RateLimiter: RateLimiter,
  RateLimiterClass: RateLimiterClass,
  Request: Request,
  Response: GlobalResponse,
  Validator: Validator,
  WebSocket: initWebSocket,
  Cache: MemoryCache,
  Redis: MemoryCache,
  info_redis: () => MemoryCache.info_redis(),
  INFO_REDIS: () => MemoryCache.INFO_REDIS(),
  cors: CorsMiddleware.handle,
  CorsMiddleware: CorsMiddleware,
  csrf: csrfHandler,
  CsrfMiddleware: CsrfMiddleware,
  static: StaticMiddleware.serve,
  mail: MailSender,
  MailSender: MailSender,
  Storage: FileStorageService,
  storage: FileStorageService,
  upload: FileStorageService,
  FileUpload: FileStorageService,
  connect: Database.connect,
  db: Database,
  query: Database.query,
  exec: Database.exec,
  insert: Database.insert,
  update: Database.update,
  delete: Database.delete,
  upsert: Database.upsert,
  count: Database.count,
  exists: Database.exists,
  fetch: Database.fetch,
  fetchAll: Database.fetchAll,
  fetchColumn: Database.fetchColumn,
  paginate: Database.paginate,
  begin: Database.begin,
  commit: Database.commit,
  rollback: Database.rollback,
  Router: createRouter,
  RouteController: RouteController,
  ApiController: ApiController.handle.bind(ApiController),
  Helper: Helper,
  ss: {
    set: (key, value) => {
      const store = requestContext.getStore();
      if (store && store.req && store.req.session) store.req.session[key] = value;
    },
    get: (key) => {
      const store = requestContext.getStore();
      return (store && store.req && store.req.session) ? store.req.session[key] : null;
    },
    reset: () => {
      const store = requestContext.getStore();
      if (store && store.req) store.req.session = {};
    },
    unset: (key) => {
      const store = requestContext.getStore();
      if (store && store.req && store.req.session) delete store.req.session[key];
    },
    regenerate: () => {
      const store = requestContext.getStore();
      if (store && store.req && store.response) {
        const oldSessionId = store.sessionId;

        const sessionLifetime = parseInt(Config.get("SESSION_LIFETIME")) || 3600;
        const newSessionId = SessionManager.start(null, sessionLifetime);

        const oldData = store.req.session;
        store.req.session = { ...oldData };

        store.sessionId = newSessionId;
        SessionManager.destroy(oldSessionId);

        store.response.cookie("VEXORA_SESSID", newSessionId, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: sessionLifetime, path: "/" });
      }
    },
    info: () => {
      const store = requestContext.getStore();
      if (store && store.req && store.req.session) {
        const session = store.req.session;
        const now = Date.now();
        const accessedAt = session._accessedAt || session._createdAt || now;
        const lifetimeMs = (session._lifetime || 3600) * 1000;
        const remainingMs = lifetimeMs - (now - accessedAt);

        return {
          id: store.sessionId,
          lifetime: session._lifetime || 3600,
          createdAt: new Date(session._createdAt || now),
          lastAccessed: new Date(accessedAt),
          expiresInSeconds: Math.max(0, Math.floor(remainingMs / 1000))
        };
      }
      return null;
    }
  },
  version: "1.0.4",
  name: "Vexora",
  framework: "Vexora Engine",

  config: Config,
  connect: Database.connect,
  db: Database,
  Server,
  http: Http,
  start(port = null, options = {}) {
    const actualPort = port || parseInt(Config.get("PORT")) || 30000;

    let serveStatic = null;
    if (options.staticDir) {
      serveStatic = StaticMiddleware.serve(
        options.staticDir,
        options.defaultIndexFile || "home.html",
        options.staticOptions || {}
      );
    }

    let enableCors = true;
    let corsOrigins = '*';
    if (options.cors !== undefined) {
      if (options.cors === false) {
        enableCors = false;
      } else {
        enableCors = true;
        if (options.cors !== true) {
          corsOrigins = options.cors;
        }
      }
    }

    const customRouter = createRouter();

    const server = Server(async (req, res) => {
      // Handle CORS headers and options preflight
      if (enableCors) {
        const preflightHandled = CorsMiddleware.handle(req, res, corsOrigins);
        if (preflightHandled) return;
      }

      const isApiRoute = req.path === '/api' || req.path.startsWith('/api/');

      if (isApiRoute) {
        // 1. ApiController autoload routes
        const handled = await ApiController.handle(req, res);
        if (handled) return;

        // 2. Custom routes defined on app
        const customHandled = await customRouter.handle(req, res);
        if (customHandled) return;
      } else {
        // 3. Serve static files (only for non-API routes)
        if (serveStatic) {
          const served = await serveStatic(req, res);
          if (served) return;
        }
      }
    });

    // Attach app.cors() to let users enable CORS manually
    server.cors = (origins = '*') => {
      enableCors = true;
      corsOrigins = origins;
      return server;
    };

    // Attach app.static() to let users override static files configuration manually
    server.static = (staticDir, defaultIndexFile = "index.html", staticOpts = {}) => {
      serveStatic = StaticMiddleware.serve(staticDir, defaultIndexFile, staticOpts);
      return server;
    };

    // Helper to enforce /api prefix on all dynamic app routes
    const getFinalUri = (uri) => {
      return uri.startsWith("/api") ? uri : "/api" + (uri.startsWith("/") ? uri : "/" + uri);
    };

    // Attach route verbs to the returned server object so users can write app.get(), app.post() etc.
    server.get = (uri, action) => { customRouter.match('GET', getFinalUri(uri), action); return server; };
    server.post = (uri, action) => { customRouter.match('POST', getFinalUri(uri), action); return server; };
    server.put = (uri, action) => { customRouter.match('PUT', getFinalUri(uri), action); return server; };
    server.patch = (uri, action) => { customRouter.match('PATCH', getFinalUri(uri), action); return server; };
    server.delete = (uri, action) => { customRouter.match('DELETE', getFinalUri(uri), action); return server; };
    server.any = (uri, action) => { customRouter.match(Router.ALL, getFinalUri(uri), action); return server; };
    server.match = (methods, uri, action) => { customRouter.match(methods, getFinalUri(uri), action); return server; };

    // Unique Vexora routing syntax: app.Vexora(get, "/path", handler)
    server.Vexora = (method, uri, action) => {
      const m = String(method).toUpperCase();
      customRouter.match(m === "ANY" ? Router.ALL : m, getFinalUri(uri), action);
      return server;
    };

    server.listen(actualPort, () => {
      console.log(`🚀 Vexora Server is running at http://localhost:${actualPort}`);
    });

    return server;
  },
  resetSuspiciousTracker: () => {
    suspiciousTracker.clear();
    BehaviorAnalyzer.reset();
  },
  captcha: (options) => Recaptcha.middleware(options),
  verifyCaptcha: (token, provider, customSecret, remoteIp) => Recaptcha.verify(token, provider, customSecret, remoteIp),
  Queue,
  QueueWorker,
  Schedule: (cronExpression, handler) => Scheduler.schedule(cronExpression, handler),
  Scheduler: Scheduler,
};

export const Nyvora = Vexora;
globalThis.Nyvora = Vexora;
export const Zentrox = Vexora;
globalThis.Zentrox = Vexora;
export const VexoraNamespace = Vexora;
globalThis.Vexora = Vexora;

// Global HTTP Verb Helpers for app.Vexora()
globalThis.get = "GET";
globalThis.post = "POST";
globalThis.put = "PUT";
globalThis.patch = "PATCH";
globalThis.delete = "DELETE";
globalThis.any = "ANY";
globalThis.info_redis = () => MemoryCache.info_redis();
globalThis.INFO_REDIS = () => MemoryCache.INFO_REDIS();
globalThis.captcha = (options) => Recaptcha.middleware(options);
globalThis.verifyCaptcha = (token, provider, customSecret, remoteIp) => Recaptcha.verify(token, provider, customSecret, remoteIp);
globalThis.Queue = Queue;
globalThis.QueueWorker = QueueWorker;
globalThis.Schedule = (cronExpression, handler) => Scheduler.schedule(cronExpression, handler);
globalThis.Scheduler = Scheduler;
export default Vexora;

// ==========================================================
// VEXORA ENGINE CLI SCAFFOLDER & HELPER
// ==========================================================
const currentFile = fileURLToPath(import.meta.url);
const executionFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (executionFile && (currentFile === executionFile || executionFile.endsWith("vexora"))) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "init") {
    console.log("⚙️ Scaffolding Vexora Project...");
    try {
      Init.setup();

      const controllersDir = path.join(process.cwd(), "controllers");
      if (!fs.existsSync(controllersDir)) {
        fs.mkdirSync(controllersDir);
      }

      const welcomeController = path.join(controllersDir, "welcome.js");
      if (!fs.existsSync(welcomeController)) {
        fs.writeFileSync(welcomeController, `// controllers/welcome.js
// Pre-injected variables: Vexora, req, res, db, params

Vexora.Response.success({
    framework: "Vexora Engine",
    status: "Healthy",
    uptime: process.uptime()
}, "Welcome to your secure Vexora Backend!");
`, "utf8");
      }

      const appScript = path.join(process.cwd(), "app.js");
      if (!fs.existsSync(appScript)) {
        fs.writeFileSync(appScript, `import Vexora from "./Vexora.js";

// Start Vexora Server (Auto-connects static serving and API controllers)
const app = Vexora.start(3000);

// Define custom routes directly using app
app.get("/", (req, res) => {
    return res.success({ hello: "world" }, "Vexora Server is Running!");
});
`, "utf8");
      }

      console.log("✅ Project successfully scaffolded!");
      console.log("👉 Run 'node app.js' to start your server.");
      console.log("👉 Try accessing GET http://localhost:3000/welcome mapping to controllers/welcome.js");
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to scaffold project:", err.message);
      process.exit(1);
    }
  } else if (command === "make:controller" && args[1]) {
    const controllerName = args[1].trim();
    console.log(`⚙️ Creating controller controllers/${controllerName}.js...`);
    try {
      const controllersDir = path.join(process.cwd(), "controllers");
      if (!fs.existsSync(controllersDir)) {
        fs.mkdirSync(controllersDir);
      }

      const file = path.join(controllersDir, `${controllerName}.js`);
      const parentDir = path.dirname(file);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (fs.existsSync(file)) {
        console.warn(`⚠️ Warning: Controller ${controllerName}.js already exists!`);
        process.exit(0);
      }

      fs.writeFileSync(file, `// controllers/${controllerName}.js
// Pre-injected context variables: Vexora, req, res, db, params

// TODO: Implement your controller logic
Vexora.Response.success({
    message: "Hello from dynamic controller controllers/${controllerName}.js"
});
`, "utf8");

      console.log(`✅ Created controllers/${controllerName}.js successfully!`);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create controller:", err.message);
      process.exit(1);
    }
  } else {
    console.log("==========================================");
    console.log("Vexora Engine - CLI Helper Tool");
    console.log("==========================================");
    console.log("Usage:");
    console.log("  node Vexora.js init                - Scaffolds a new Vexora project");
    console.log("  node Vexora.js make:controller <n> - Generates a new dynamic controller script");
    console.log("==========================================");
    process.exit(0);
  }
}

