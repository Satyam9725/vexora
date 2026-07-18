# Vexora Framework 🚀

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/vexora.svg?style=flat-square&color=FF5733)](https://www.npmjs.com/package/vexora)
[![NPM Downloads](https://img.shields.io/npm/dm/vexora.svg?style=flat-square&color=33b2ff)](https://www.npmjs.com/package/vexora)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](#)
[![Node Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-blue.svg?style=flat-square)](#)

**Vexora** is an advanced, blazing-fast, and zero-dependency backend framework for Node.js. Build high-performance APIs, real-time WebSockets, and database-driven applications without NPM dependency bloat.

[Key Features](#-key-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Architecture](#%EF%B8%8F-internal-architecture) • [Documentation](#%EF%B8%8F-core-modules-documentation)

</div>

---

## ✨ Key Features

- 📦 **Zero-Dependency Core**: Built entirely on native Node.js APIs (`http`, `crypto`, `events`, `async_hooks`) — zero third-party package overhead.
- ⚡ **Ultra-High Performance**: Near-native HTTP throughput (~90k requests/sec), outperforming standard middleware pipelines.
- 🧵 **Thread-Safe Request Context**: Access active requests, responses, and session structures globally anywhere in your code using `AsyncLocalStorage` (no prop-drilling).
- 🔌 **Native WebSockets**: Built-in binary frame parser and unmasking engine built directly into raw TCP streams.
- 🗄️ **Multi-Connection Database Multiplexer**: Built-in connection pool routing supporting MySQL and PostgreSQL simultaneously with auto-escaping, pagination, and savepoints.
- 🔐 **Military-Grade Security by Default**: Security headers, CORS preflight checks, sliding-window Rate-Limiting, recursive input parameter auto-trimming, and `AES-256-GCM` authenticated encryption.
- 💾 **Native RAM Cache (Redis Equivalent)**: Sub-microsecond memory store with TTL eviction, atomic counters, and automatic Garbage Collector.
- 🪵 **Secure Silent Logging**: Masks sensitive request attributes, conceals absolute filesystem paths, and logs errors with unique UUID Error IDs.

---

## 📦 Installation

To install Vexora in your project, run:

```bash
npm install vexora
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

### 2. Configure Databases (`.Vexora/config`)
Write multiple connection strings directly using standard URLs (special characters in passwords are handled automatically).

```ini
# Default Database
MYSQL_DB_URL=mysql://db_user:password@localhost:3306/primary_db

# Auth Connection Key
MYSQL_DB_AUTH=mysql://auth_user:pass123@localhost:3306/auth_db
```

---

## 🗄️ Multi-Connection CRUD Operations

Vexora dynamically multiplexes queries based on config keys. Pass the database configuration key as the first argument, or omit it to target `MYSQL_DB_URL` by default.

```javascript
// 1. Check if user email exists (Sanitized & Quoted natively)
const exists = await Vexora.exists("MYSQL_DB_AUTH", "users", "email = ?", ["test@email.com"]);

// 2. Secure Insert (Returns insertId / primary key)
const userId = await Vexora.insert("MYSQL_DB_AUTH", "users", {
    email: "test@email.com",
    username: "john_doe",
    status: "active"
});

// 3. Dynamic Fetch Row
const user = await Vexora.fetch("MYSQL_DB_AUTH", "SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);

// 4. Raw execution
await Vexora.exec("UPDATE users SET status = ? WHERE id = ?", ["suspended", userId]);
```

---

## 🧵 Global Request Context

No need to pass the `req` object down through dozens of helper functions. Vexora manages contextual state natively.

```javascript
import Vexora from "vexora";

// Accessible anywhere in your application!
function checkPermissions() {
    const role = Vexora.Request.input("role", "guest"); // Auto-Trimming active
    const ip = Vexora.Request.ip();
    
    if (role === "admin") {
        Vexora.ss.set("is_admin", true); // Store session in RAM
        return true;
    }
    return false;
}
```

---

## ⚙️ Internal Architecture

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

---

## 🛠️ Core Modules Documentation

### 💾 RAM Cache (`Vexora.Redis` / `Vexora.Cache`)
Sub-microsecond memory key-value operations with TTL and atomic actions.
```javascript
// Set cached object with 60 seconds TTL
Vexora.Redis.set("session:token", { userId: 45 }, 60);

// Retrieve cache
const val = Vexora.Redis.get("session:token");

// Atomic Counters
Vexora.Redis.incr("page_hits");
```

### 🔐 Cryptographic Helpers (`Vexora.Helper`)
Secure cryptographically-sound hashing and encryption.
```javascript
// Secure Scrypt hashing & timing-safe verification
const hashed = Vexora.Helper.hashPassword("my_secret_pass");
const isValid = Vexora.Helper.verifyPassword("my_secret_pass", hashed);

// AES-256-GCM authenticated encryption (uses AES_SECRET in config)
const secretMessage = Vexora.Helper.encrypt("sensitive information");
const decryptedText = Vexora.Helper.decrypt(secretMessage);
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

### 📜 Security Shield & Audit Logger
Vexora keeps your production environments secure:
- **DDoS Block**: Global Rate Limiter returns HTTP 429 with dynamic wait metrics in JSON response.
- **XSS & Clickjacking Protection**: Security headers (such as `nosniff`, `X-Frame-Options`) are set automatically.
- **Muted Error Traces**: Production logs hide absolute terminal stack traces, masked fields (like passwords, CVVs) are redacted, and errors are assigned unique UUIDs for client lookup.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*Built with passion by Satyam Kumar (<satyam.ku9725@gmail.com>)* 🚀# vexora