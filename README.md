# Vexora Framework 🚀

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/vexora.svg?style=flat-square&color=FF5733)](https://www.npmjs.com/package/vexora)
[![NPM Downloads](https://img.shields.io/npm/dm/vexora.svg?style=flat-square&color=33b2ff)](https://www.npmjs.com/package/vexora)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](#)
[![Node Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-blue.svg?style=flat-square)](#)

**Vexora** is an advanced, enterprise-grade, blazing-fast, and zero-dependency backend framework for Node.js. Build high-performance REST APIs, real-time WebSockets, and complex database-driven architectures without any NPM dependency bloat.

[Key Features](#-key-features) • [Installation](#-installation) • [Architecture](#-vexora-internal-architecture) • [Routing](#-routing--controller-system) • [Database](#-multi-connection-database-routing--crud) • [API Reference](#%EF%B8%8F-api-reference)

</div>

---

## ✨ Key Features

- 📦 **Zero-Dependency Core**: Built 100% on top of Node.js native core libraries (`http`, `crypto`, `events`, `async_hooks`) — zero third-party package dependencies.
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

### 🔌 Real-Time WebSockets (`Vexora.WebSocket`)
Blazing-fast real-time layer communicating directly on TCP socket streams.
```javascript
const io = Vexora.WebSocket(server);

io.on("connection", (socket) => {
    socket.send({ welcome: "Connected to Vexora WebSockets!" });

    socket.on("message", (msg) => {
        socket.broadcast("Broadcast message: " + msg);
    });
});
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