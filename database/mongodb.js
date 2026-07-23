"use strict";

/**
 * ==========================================================
 * Vexora Framework - Native MongoDB Driver Connector
 * ==========================================================
 *
 * @author      Satyam Kumar
 * @email       satyam.ku9725@gmail.com
 * @phone       +91 9725399936
 * @github      https://github.com/Satyam9725
 *
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 *
 * ==========================================================
 */

import { performance } from "node:perf_hooks";

let clientInstance = null;
let dbInstance = null;

/**
 * Build MongoDB URI automatically from config object
 */
export function buildMongoUri(config) {
  if (typeof config === "string") {
    return config;
  }

  const { host = "localhost", user = "", password = "", database = "vexora_db", port = 27017, appName } = config;
  
  // Safe URL-encode password and user to prevent special character breakages like '@' or '#'
  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);

  const isCluster = host.includes("cluster") || host.includes(".mongodb.net");
  const protocol = isCluster ? "mongodb+srv" : "mongodb";

  let uri = "";
  if (user && password) {
    uri = `${protocol}://${encodedUser}:${encodedPass}@${host}`;
  } else {
    uri = `${protocol}://${host}`;
  }

  if (!isCluster && port) {
    uri += `:${port}`;
  }

  uri += `/${database}`;

  if (appName) {
    uri += `?appName=${appName}`;
  }

  return uri;
}

/**
 * Connect to MongoDB Database
 */
async function connect(connectionInput) {
  if (dbInstance) {
    return dbInstance;
  }

  let mongoModule;
  try {
    mongoModule = await import("mongodb");
  } catch (err) {
    console.error("❌ MongoDB package not installed.");
    throw new Error("MongoDB driver missing. Please run 'npm install mongodb' to use MongoDB in Vexora.");
  }

  const { MongoClient } = mongoModule;
  const uri = buildMongoUri(connectionInput);
  const dbName = typeof connectionInput === "object" ? (connectionInput.database || connectionInput.DB_NAME || "vexora_db") : undefined;

  try {
    const start = performance.now();
    clientInstance = new MongoClient(uri, {
      maxPoolSize: 20,
      connectTimeoutMS: 10000,
    });

    await clientInstance.connect();
    dbInstance = clientInstance.db(dbName);
    
    const end = performance.now();
    console.log(`✅ MongoDB Connected (${(end - start).toFixed(2)}ms)`);
    return dbInstance;
  } catch (err) {
    clientInstance = null;
    dbInstance = null;
    console.error("❌ MongoDB Connection Failed:", err.message);
    throw err;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnect() {
  if (!clientInstance) return;
  await clientInstance.close();
  clientInstance = null;
  dbInstance = null;
  console.log("🔌 MongoDB Disconnected");
}

/**
 * Health Check / Ping
 */
async function ping() {
  if (!dbInstance) {
    throw new Error("MongoDB not connected.");
  }
  await dbInstance.command({ ping: 1 });
  return true;
}

/**
 * Access Collection directly
 */
function collection(name) {
  if (!dbInstance) {
    throw new Error("MongoDB not connected. Call Vexora.DB.connect() first.");
  }
  return dbInstance.collection(name);
}

/**
 * Get active DB instance
 */
function getDb() {
  return dbInstance;
}

export default {
  connect,
  disconnect,
  ping,
  collection,
  getDb,
  buildMongoUri,
};
