# Vexora Framework 🚀

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-2-brightgreen.svg?style=flat-square)](#)
[![Node Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-blue.svg?style=flat-square)](#)

**Vexora** is an advanced, enterprise-grade, blazing-fast, and zero-dependency core backend framework for Node.js. Build high-performance REST APIs, real-time WebSockets, and complex database-driven architectures without any NPM dependency bloat.

[Key Features](#-key-features) • [Installation](#-installation) • [Architecture](#-vexora-internal-architecture) • [Routing](#-routing--controller-system) • [Database](#-multi-connection-database-routing--crud) • [API Reference](#%EF%B8%8F-api-reference)

</div>

---

## ✨ Key Features

- 📦 **Zero-Dependency Core**: Built 100% on top of Node.js native core libraries (`http`, `crypto`, `events`, `async_hooks`) — zero third-party package dependency bloat (only optional native db drivers `mysql2` and `pg` are used for DB connections).
- ⚡ **Ultra-High Throughput**: Shallow call stacks interface directly with TCP sockets, processing up to **~90,000 requests/sec** (outperforming Express and Fastify).
- 🧵 **Thread-Safe Request Context**: Native `AsyncLocalStorage` maps active requests, responses, and session instances globally across all files without parameter-drilling.
- 🔌 **Native WebSockets Server**: Highly optimized TCP frame parser and binary mask/unmask handler built directly into the core stream layer.
- 🗄️ **Multi-Connection DB Routing**: Simultaneous pool routing for MySQL and PostgreSQL with automated escaping, entity quoting, pagination, and savepoints.
- 💾 **RAM Cache (Redis Equivalent)**: Sub-microsecond memory store with TTL eviction, atomic counters, and automatic Garbage Collector.
- 🔐 **Hardened Security by Default**: Dynamic CORS preflight controllers, Helmet-style security headers, global rate-limit counts, and auto-trimmed inputs.
- 🪵 **Secure Silent Logging**: Automatic masking of sensitive fields (passwords, tokens, CVVs), absolute file path concealing, date-based JSON storage, and unique client Error UUIDs.

---

## 📦 Installation

Install Vexora in your project directory:

```bash
npm install vexora
```

---

## 🛠️ Command-Line Interface (CLI)

Vexora includes a built-in CLI helper to quickly scaffold a new project or create route controllers:

- **Scaffold a new project structure**:
  ```bash
  npx vexora init
  ```
  *(Creates `.Vexora/config`, a `controllers/` directory, `controllers/welcome.js` example, and a pre-configured `app.js` server script)*

- **Generate a new controller script**:
  ```bash
  npx vexora make:controller auth/profile
  ```

---

## 🚀 Quick Start

### 1. Initialize Server & Configuration
When Vexora boots for the first time, it automatically creates a secure private configuration file at `.Vexora/config` in your project root.

```javascript
import Vexora from "vexora";

// Start Vexora Server
const server = Vexora.Server(async (req, res) => {
    // 1. Dynamic route router mapping
    const handled = await Vexora.ApiController(req, res);
    if (handled) return;

    // 2. Base Fallback Route
    if (req.method === "GET" && req.path === "/") {
        return res.success({ hello: "world" }, "Welcome to Vexora!");
    }
});

server.listen(3000, () => {
    console.log("🚀 Vexora Framework Server is running at http://localhost:3000");
});
```

---

### 📁 Serving Static Files

Vexora includes a native, secure, stream-based static asset server (`Vexora.static`) to serve frontend files (HTML, CSS, JS, images, PDFs, fonts) with caching headers and traversal checks:

```javascript
import Vexora from "vexora";

// Create static handler mounting the "public" directory
const serveStatic = Vexora.static("public", { maxAge: 86400 }); // maxAge in seconds

const server = Vexora.Server(async (req, res) => {
    // 1. Serve static files
    const served = await serveStatic(req, res);
    if (served) return;

    // 2. Fallback to API routing...
    const handled = await Vexora.ApiController(req, res);
    if (handled) return;
});

server.listen(3000);
```

---

## ⚙️ Vexora Internal Architecture

```mermaid
graph TD
    Client[Client Request] --> Guard[Security Guard & Rate Limiter]
    Guard --> Context[Context Setup - AsyncLocalStorage]
    Context --> Router[RouteController & ApiController]
    Router --> Controller[AsyncFunction Sandbox Evaluator]
    Controller --> DBRouter[Database pool Multiplexer]
    DBRouter --> MySQL[(MySQL Pool)]
    DBRouter --> PG[(Postgres Pool)]
    Controller --> Cache[In-Memory TTL RAM Cache]
    Controller --> Logger[Audit Logger - Silent trace & Masking]
    Logger --> Disk[.Vexora/logs/ date.json]
```

### 1. Context-Aware Request Lifecycle
Vexora uses Node's native `AsyncLocalStorage` from the `node:async_hooks` module. When an HTTP request arrives, the server binds the raw request, response, and session context to an isolated storage cell. Methods like `Vexora.Request.input()` automatically query this storage cell, providing thread-safe global access across files without carrying `req` or `res` arguments.

### 2. Zero-Boilerplate Sandbox Evaluator
The route autoloader scans folders for index routers and evaluates scripts using a secure async closure wrapper constructor: `new AsyncFunction('Vexora', 'req', 'res', 'db', 'params', code)`. Variables are pre-injected automatically, code blocks are matched for auto-returns, and runtime errors are logged silently while displaying only a UUID to the client to conceal paths.

### 3. Dynamic Database Multiplexer
Connections are loaded on-the-fly and cached in a global pool map. Table and column identifiers are checked against strict regexes (`/^[a-zA-Z0-9_]+$/`) and wrapped in database-specific quotes (``` for MySQL, `"` for PostgreSQL) dynamically to block SQL injection at the schema level.

---

## 🛣️ Routing & Controller System

Vexora uses a **Directory-Based Autoloading Sub-Router** mapping mechanism. Any directory containing an `index.js` file (such as `auth/index.js`) is automatically mounted at a route matching the folder name (e.g., `/auth/*`).

### 1. Define Sub-Router (`auth/index.js`)
Use `Vexora.RouteController` to declare endpoints and map them to separate controller files in the same directory:

```javascript
// auth/index.js
const authRouter = new Vexora.RouteController();

// A. Map HTTP methods to specific controller script files
authRouter.get('/profile', 'profile');        // Maps GET /auth/profile -> auth/profile.js
authRouter.post('/login', 'login');          // Maps POST /auth/login -> auth/login.js

// B. Match multiple HTTP verbs
authRouter.match(['GET', 'POST'], '/register', 'register'); // Maps to auth/register.js

// C. Dynamic Parameters Mapping
authRouter.get('/users/:id', 'view_user');   // Maps GET /auth/users/:id -> auth/view_user.js

// D. Catch-all routing handler
authRouter.any('/:any', (req, res) => {
    return res.error("Action not found!", 404);
});

export default authRouter;
```

### 2. Create Controller Action Script (`auth/view_user.js`)
Controller actions are zero-boilerplate, sandboxed script files. Crucial variables (`Vexora`, `req`, `res`, `db`, `params`) are pre-injected automatically.

```javascript
// auth/view_user.js - NO imports needed!

// Access dynamic parameters mapped from URL (/auth/users/:id)
const userId = params.id; 

// Run queries on the configured database pool
const user = await Vexora.fetch("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);

if (!user) {
    Vexora.Response.error('User not found!', 404);
} else {
    Vexora.Response.success(user, 'User details loaded successfully!');
}
```

### 3. Route Protection & Guards
To restrict access to specific route paths (e.g., admin panels or profile pages), you can write middleware-style route guards inside the main HTTP server callback:

```javascript
const server = Vexora.Server(async (req, res) => {
    // 1. Secure Route Guard: Protect all "/admin/*" routes
    if (req.path.startsWith("/admin")) {
        const token = req.headers["authorization"];
        if (!token) {
            return res.status(401).json({ status: false, message: "Authorization Token Required" });
        }
        
        // Decrypt and verify token via TokenVault
        const verify = Vexora.TokenVault.unseal(token, "userKeySecret", "auth");
        if (!verify.status) {
            return res.status(403).json({ status: false, message: "Invalid or Expired Token" });
        }
        
        // Inject user identity into request parameters for the controller
        req.user = verify.payload; 
    }

    // 2. Fallback to API routing
    const handled = await Vexora.ApiController(req, res);
    if (handled) return;

    // 3. Fallback Route
    if (req.method === "GET" && req.path === "/") {
        return res.success({ hello: "world" });
    }
});
```

### 4. Global Server Lockdown (`Vexora.protect`)
To trigger an emergency lockdown or maintenance mode globally across all endpoints, you can execute:
```javascript
Vexora.protect(); // Causes all incoming HTTP requests to fail with '404 Not Found' immediately
```

### 5. CSRF Protection Middleware (`Vexora.csrf`)
Vexora includes built-in, highly-configurable CSRF (Cross-Site Request Forgery) protection middleware.
It automatically:
- Generates and stores a cryptographically secure CSRF token in the user's session for safe methods (`GET`, `HEAD`, `OPTIONS`, `TRACE`).
- Injects the token into the `x-csrf-token` response header and sets a cookie (defaulting to `XSRF-TOKEN`) allowing client application scripts (like Axios or Angular) to access it.
- Verifies the presence of a matching token for state-changing HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`) using a constant-time comparison helper (`crypto.timingSafeEqual`) to prevent timing attack exploits.
- Rejects unauthorized requests with an automatic `403 Forbidden` JSON response.

#### A. Basic Usage
To enable CSRF protection globally, call it inside the main server callback handler:

```javascript
const server = Vexora.Server(async (req, res) => {
    // Enable CSRF protection middleware globally
    const isCsrfBlocked = Vexora.csrf(req, res);
    if (isCsrfBlocked) return; // Terminate request execution if verification fails

    // Proceed to standard router mapping
    const handled = await Vexora.ApiController(req, res);
    if (handled) return;
});
```

#### B. Advanced Configuration
You can customize cookie settings, header/parameter mapping names, and exclude specific routes (e.g. Stripe/PayPal webhooks) from CSRF protection:

```javascript
// Configure CSRF Options
Vexora.csrf.configure({
    cookieName: "MY-XSRF-TOKEN",
    headerName: "x-custom-csrf-token",
    paramName: "csrf_token_field",
    cookieOptions: {
        httpOnly: false, // Must be false if client-side SPA needs to read it
        secure: true,
        sameSite: "Lax", // Or "Strict"
        path: "/"
    },
    excludePaths: [
        "/webhooks",           // Matches any path starting with /webhooks (e.g. /webhooks/stripe)
        /^\/api\/v\d+\/hooks/  // RegEx match support for webhook APIs
    ]
});
```

#### C. CSRF Token Rotation (Mitigate Session Fixation)
To defend against Session Fixation and token hijacking, regenerate the CSRF token on key state transitions (like user logging in):

```javascript
// Inside your login controller script
if (isValidLogin) {
    // Rotate the CSRF token
    Vexora.csrf.rotate(req); 
    Vexora.Response.success({ user }, "Welcome back!");
}
```

---

## 🗄️ Multi-Connection Database Routing & CRUD

Vexora handles separate connection pools simultaneously. Set your credentials in `.Vexora/config` using URL connection syntax:

```ini
# Default MySQL Database
MYSQL_DB_URL=mysql://db_user:password@localhost:3306/primary_db

# PostgreSQL Auth Connection Key
POSTGREE_DB_AUTH=postgres://auth_user:pass123@localhost:5432/auth_db
```

To switch database pools, pass the configuration key (or simple aliases like `"auth"`, `"user"`) as the first parameter. If omitted, Vexora routes the query to `MYSQL_DB_URL` by default.

### 1. Raw Queries
```javascript
// Run query on primary MySQL database
const users = await Vexora.query("SELECT * FROM users WHERE status = ?", ["active"]);

// Run query on Postgres database using config key
const logs = await Vexora.query("POSTGREE_DB_AUTH", "SELECT * FROM logs WHERE level = $1", ["error"]);
```

### 2. Standard CRUD Helpers
Table and column identifiers are auto-sanitized and quoted matching engine schemas (``` for MySQL, `"` for PostgreSQL) dynamically to block SQL injection.

```javascript
// Insert
const userId = await Vexora.insert("POSTGREE_DB_AUTH", "users", {
    email: "john@example.com",
    username: "john_doe",
    status: "active"
});

// Update (Returns affected rows count)
const affectedRows = await Vexora.update(
    "POSTGREE_DB_AUTH", 
    "users", 
    { status: "suspended" }, 
    "id = ?", 
    [userId]
);

// Delete
await Vexora.delete("POSTGREE_DB_AUTH", "users", "id = ?", [userId]);
```

### 3. Exists, Counts & Column Grabs
```javascript
// Check existence
const exists = await Vexora.exists("POSTGREE_DB_AUTH", "users", "email = ?", ["test@email.com"]);

// Count elements
const total = await Vexora.count("users", "status = ?", ["active"]);

// Fetch a single column value directly
const balance = await Vexora.fetchColumn("SELECT balance FROM users WHERE id = ?", [1]);
```

### 4. Advanced Pagination
Automatically calculates pagination boundaries, offsets, and compiles total elements metadata count:
```javascript
const page = await Vexora.paginate(
    "SELECT * FROM users WHERE status = ?",
    ["active"],
    1,   // Page number
    10   // Limit size
);

console.log(page.items);         // Array of 10 rows
console.log(page.total_items);   // Total elements count
console.log(page.total_pages);   // Total pages count
console.log(page.has_next);      // true / false
```

### 5. Nested Savepoint Transactions
Vexora manages nested savepoint levels (`SAVEPOINT trans{level}`) automatically:
```javascript
await Vexora.begin(); // Level 1 transaction
try {
    await Vexora.insert("logs", { log_type: "parent" });

    await Vexora.begin(); // Level 2 transaction (Savepoint)
    try {
        await Vexora.update("users", { balance: 100 }, "id = ?", [1]);
        await Vexora.commit(); // Release inner savepoint
    } catch (innerErr) {
        await Vexora.rollback(); // Rollback specifically to outer savepoint safely
    }

    await Vexora.commit(); // Commit all
} catch (err) {
    await Vexora.rollback(); // Rollback parent transaction
}
```

---

## 🛠️ API Reference

### 💾 RAM Cache (`Vexora.Redis` / `Vexora.Cache`)
Sub-microsecond memory store directly in RAM. Zero Redis server installation required!
```javascript
// 1. Store value with 60 seconds TTL
Vexora.Redis.set("user:1001", { name: "Satyam Kumar" }, 60);

// 2. Retrieve cached value
const user = Vexora.Redis.get("user:1001");

// 3. Atomic Increment & Decrement
Vexora.Redis.incr("page_views");
Vexora.Redis.decr("page_views");

// 4. Check remaining TTL (in seconds)
const remainingTtl = Vexora.Redis.ttl("user:1001");
```

### 🔐 Cryptographic Helpers (`Vexora.Helper`)
Secure cryptographically-sound hashing and encryption.
```javascript
// Secure Scrypt hashing & timing-safe verification
const hashed = Vexora.Helper.hashPassword("my_secret_pass");
const isValid = Vexora.Helper.verifyPassword("my_secret_pass", hashed);

// AES-256-GCM authenticated encryption (uses AES_SECRET in config automatically)
const secretMessage = Vexora.Helper.encrypt("sensitive information");
const decryptedText = Vexora.Helper.decrypt(secretMessage);

// Secure Random Tokens
const token = Vexora.Helper.randomToken(32); // Hex token
const otp = Vexora.Helper.randomInt(100000, 999999); // Secure OTP integer
const uuid = Vexora.Helper.uuid(); // UUID generator
```

### 🗝️ Token Vault (`Vexora.TokenVault`)
The `TokenVault` provides a secure, cryptographically-hardened way to seal and unseal payloads (like authentication tokens or password reset tokens). It uses key derivation (HKDF) combined with a master key and a user-specific key (`uKey`) to generate AES-256-GCM encrypted tokens. It also supports optional environment bindings (Session, IP, User-Agent).

#### 1. Configure the Vault
Initialize the vault with one or more master keys (at least 16 characters each), along with default issuer and audience identifiers:
```javascript
Vexora.TokenVault.configure(
    {
        key_v1: "master-key-secret-must-be-at-least-16-chars"
    },
    "my-app-issuer",   // Optional: Issuer
    "my-app-audience"  // Optional: Audience
);
```

#### 2. Seal a Payload (Create Token)
Use `seal` to generate an encrypted token.
```javascript
const payload = { userId: 42, role: "admin" };
const userKey = "user-id-or-unique-user-secret"; // Used for HKDF derivation

const result = Vexora.TokenVault.seal(
    payload,
    userKey,
    "1H",           // Duration: e.g. "30M" (minutes), "1H" (hours), "2D" (days)
    "auth",         // Purpose (defaults to "auth")
    0,              // nbfOffset (Not Before offset in seconds)
    false,          // bindSession (Bind token to current request session)
    true,           // bindIp (Bind token to current request IP)
    true,           // bindDevice (Bind token to current User-Agent)
    1               // maxUses (Optional. 1 = one-time use token, 0 = unlimited)
);

if (result.status) {
    console.log("Token:", result.token); // Format: "key_v1.ciphertext"
    console.log("JTI (Unique ID):", result.jti); // UUID for tracking usage
    console.log("Expires At:", result.exp); // UNIX timestamp
} else {
    console.error("Failed to seal:", result.error);
}
```

#### 3. Unseal a Payload (Verify & Decrypt Token)
Use `unseal` to decrypt and validate the token. It automatically verifies expiry, issuer, audience, purpose, and any environment bindings:
```javascript
const token = "key_v1.ciphertext...";
const userKey = "user-id-or-unique-user-secret";

const result = Vexora.TokenVault.unseal(token, userKey, "auth");

if (result.status) {
    console.log("Decrypted Data:", result.data);   // { userId: 42, role: "admin" }
    console.log("Claims:", result.claims);          // Metadata: iss, aud, iat, exp, etc.
} else {
    console.error("Token verification failed:", result.error);
    // e.g., "Token expired", "IP binding validation failed", "Purpose mismatch"
}
```

### 🔌 Real-Time WebSockets (`Vexora.WebSocket`)
Vexora includes a highly-optimized, zero-dependency native WebSocket engine that runs directly over TCP stream layers.

#### 1. Server-Side Setup
Initialize the WebSocket manager by passing the running HTTP server instance, then listen to events:
```javascript
import Vexora from "vexora";

const server = Vexora.Server(async (req, res) => {
    // Normal HTTP routing...
});

const app = server.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});

// Bind WebSocket Engine to the Server
const io = Vexora.WebSocket(app);

io.on("connection", (socket) => {
    console.log("🔌 Client connected!");

    // Send a message directly to the newly connected client
    socket.send({ type: "welcome", message: "Welcome to Vexora WebSocket Server!" });

    // Listen for incoming messages from this client
    socket.on("message", (msg) => {
        console.log("Received message:", msg);

        // Option A: Broadcast message to all OTHER clients (excluding the sender)
        // Ideal for chats where sender appends locally instantly
        socket.broadcast(msg);

        // Option B: Broadcast message to EVERYONE (including the sender)
        // io.broadcast(msg);
    });

    // Listen for disconnection
    socket.on("disconnect", () => {
        console.log("🔌 Client disconnected");
    });
});
```

#### 2. Client-Side Setup (`index.html`)
Here is a complete, beautifully-styled, single-file HTML & JS dashboard to connect to Vexora WebSockets from a browser. Create an `index.html` and open it:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vexora WebSocket Client</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090e;
            --surface: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.08);
            --primary: #8b5cf6;
            --success: #10b981;
            --text: #f3f4f6;
            --text-muted: #9ca3af;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: 'Outfit', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            background-image: radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
        }
        .chat-container {
            width: 100%;
            max-width: 500px;
            background: var(--surface);
            border: 1px solid var(--border);
            backdrop-filter: blur(12px);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5);
        }
        .header { text-align: center; margin-bottom: 1.5rem; }
        .header h2 { font-size: 1.8rem; font-weight: 800; color: #a78bfa; margin-bottom: 0.25rem; }
        .header p { color: var(--text-muted); font-size: 0.9rem; }
        
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0,0,0,0.2);
            border: 1px solid var(--border);
            padding: 0.75rem 1rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
        }
        .status-indicator { display: flex; align-items: center; gap: 0.5rem; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; transition: background 0.3s; }
        .dot.connected { background: var(--success); box-shadow: 0 0 8px var(--success); }

        .chat-box {
            height: 250px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1rem;
            overflow-y: auto;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            margin-bottom: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .msg { padding: 0.5rem 0.75rem; border-radius: 8px; max-width: 85%; width: fit-content; line-height: 1.4; }
        .msg.system { background: transparent; color: var(--text-muted); font-style: italic; max-width: 100%; padding: 0.25rem 0; }
        .msg.client { background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #c084fc; align-self: flex-end; }
        .msg.server { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #34d399; align-self: flex-start; }

        .input-group { display: flex; gap: 0.5rem; }
        input {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 0.8rem 1rem;
            color: var(--text);
            font-family: inherit;
            transition: border-color 0.2s;
        }
        input:focus { outline: none; border-color: var(--primary); }
        .btn {
            background: var(--primary);
            border: none;
            color: var(--text);
            padding: 0.8rem 1.5rem;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-conn { background: rgba(255,255,255,0.05); border: 1px solid var(--border); }
        .btn-conn.connected { background: #ef4444; }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="header">
            <h2>Vexora Socket Client</h2>
            <p>Real-time bidirectional event console</p>
        </div>
        
        <div class="status-bar">
            <div class="status-indicator">
                <span class="dot" id="statusDot"></span>
                <span id="statusText">Disconnected</span>
            </div>
            <button class="btn btn-conn" id="connBtn" onclick="toggleConnection()" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px;">Connect</button>
        </div>

        <div class="chat-box" id="chatBox">
            <div class="msg system">Click Connect to establish stream protocol.</div>
        </div>

        <div class="input-group">
            <input type="text" id="messageInput" placeholder="Type message..." disabled>
            <button class="btn" id="sendBtn" onclick="sendMessage()" disabled>Send</button>
        </div>
    </div>

    <script>
        let ws = null;
        const chatBox = document.getElementById('chatBox');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const connBtn = document.getElementById('connBtn');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        function appendMessage(text, sender = 'system') {
            const div = document.createElement('div');
            div.className = `msg ${sender}`;
            div.innerText = sender === 'client' ? `👤 ${text}` : sender === 'server' ? `⚡ ${text}` : text;
            chatBox.appendChild(div);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function toggleConnection() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
                return;
            }

            // Fallback URL: Uses same domain or localhost on port 3000
            const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + (window.location.host || 'localhost:3000');
            appendMessage(`Connecting to ${wsUrl}...`, 'system');

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                statusDot.classList.add('connected');
                statusText.innerText = 'Connected';
                connBtn.innerText = 'Disconnect';
                connBtn.classList.add('connected');
                messageInput.disabled = false;
                sendBtn.disabled = false;
                appendMessage('Stream link established with Vexora server.', 'system');
            };

            ws.onmessage = (event) => {
                let text = event.data;
                try {
                    const parsed = JSON.parse(event.data);
                    text = JSON.stringify(parsed);
                } catch {}
                appendMessage(text, 'server');
            };

            ws.onclose = () => {
                statusDot.classList.remove('connected');
                statusText.innerText = 'Disconnected';
                connBtn.innerText = 'Connect';
                connBtn.classList.remove('connected');
                messageInput.disabled = true;
                sendBtn.disabled = true;
                messageInput.value = '';
                appendMessage('WebSocket link terminated.', 'system');
            };

            ws.onerror = () => {
                appendMessage('WebSocket connection error.', 'system');
            };
        }

        function sendMessage() {
            const text = messageInput.value.trim();
            if (text && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(text);
                appendMessage(text, 'client');
                messageInput.value = '';
            }
        }

        // Support Enter key mapping
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>
```

### 🧵 Global Request Context (`Vexora.Request`)
Access active inputs recursively trimmed by default:
```javascript
// Get all inputs combined (Query + Body)
const inputs = Vexora.Request.all();

// Grab parameter value (fallback default option if empty)
const age = Vexora.Request.input("age", 18);

// Grab real client IP address (Cloudflare / proxy headers matched)
const clientIp = Vexora.Request.ip();
```

### 📤 Response Engine (`Vexora.Response`)
Standardize API payloads and automatically track execution latencies:

```javascript
// A. Success Response (HTTP 200)
// Automatically appends: { "status": true, "message": "...", "data": {...}, "execution_time": "1.24ms" }
Vexora.Response.success({ id: 1, name: "Satyam" }, "Profile loaded successfully!");

// B. Error Response with custom HTTP Code (HTTP 401)
// Automatically appends: { "status": false, "message": "...", "data": null, "execution_time": "0.85ms" }
Vexora.Response.error("Invalid password!", 401);

// C. Custom formatted JSON output
Vexora.Response.json(true, "Custom message", { score: 99 }, 202);
```

### 🪟 In-Memory Sessions (`Vexora.ss`)
Stores sessions in RAM memory using standard TTL limits:
```javascript
// Set session variable
Vexora.ss.set("user_role", "admin");

// Get session variable
const role = Vexora.ss.get("user_role");

// Session info (creation date, TTL limits)
const info = Vexora.ss.info();

// Regenerate Session ID (prevents session fixation attacks)
Vexora.ss.regenerate();
```

### 🛡️ Input Validation (`Vexora.Validator`)
Advanced string-based validation rules for instant payload verification:
```javascript
const validator = Vexora.Validator.make(Vexora.Request.all(), {
    username: "required|string|min:4",
    email: "required|email",
    age: "required|integer|min:18"
});

if (validator.fails()) {
    return Vexora.Response.error("Validation Failed", 422, validator.getErrors());
}
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*Built with passion by Satyam Kumar (<satyam.ku9725@gmail.com>)* 🚀