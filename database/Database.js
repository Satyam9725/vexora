"use strict";

/**
 * ==========================================================
 * Vexora Framework - Database Engine Connection Router
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

import fs from "node:fs";
import path from "node:path";
import mysql from "./mysql.js";
import postgres from "./postgres.js";
import Config from "../core/config.js";
import MySqlQueryBuilder from "./QueryBuilder/MySqlQueryBuilder.js";
import PostgresQueryBuilder from "./QueryBuilder/PostgresQueryBuilder.js";

class Database {
  static instance = null;
  static connections = {}; // Keeps track of all active named database connections

  static async connect(connectionInput, dbKey = "default") {
    // If we already connected to this database key, return it
    if (Database.connections[dbKey]) {
      return Database.connections[dbKey];
    }

    let input = connectionInput;

    // Standardize PHP-style database keys to Vexora keys
    if (typeof input === "object" && input !== null) {
        input = {
            host: input.host || input.DB_HOST || "localhost",
            user: input.user || input.username || input.DB_USER || "root",
            password: input.password || input.pass || input.DB_PASS || "",
            database: input.database || input.dbname || input.DB_NAME || "",
            port: parseInt(input.port || input.DB_PORT) || 3306,
            driver: input.driver || input.DB_DRIVER || "mysql"
        };
    }

    // If no argument is passed, auto-detect from Config
    if (!input) {
      const host = Config.get("DB_HOST");
      const user = Config.get("DB_USER");
      const pass = Config.get("DB_PASS");
      const name = Config.get("DB_NAME");
      const port = Config.get("DB_PORT");
      const driver = Config.get("DB_DRIVER") || "mysql";
      const url = Config.get("MYSQL_DB_URL") || Config.get("MYSQL_DB_AUTH") || Config.get("MYSQL_DB_USER") || Config.get("DB_URL");

      if (host && user && name) {
        input = {
          host,
          user,
          password: pass || "",
          database: name,
          port: port || 3306,
          driver
        };
      } else if (url) {
        input = url;
      } else {
        throw new Error("Database configuration missing in .Vexora/config");
      }
    }

    let protocol = "mysql";

    if (typeof input === "string") {
      try {
        if (input.startsWith("postgres://") || input.startsWith("postgresql://")) {
          protocol = "postgres";
        } else {
          protocol = "mysql";
        }
      } catch {
        protocol = "mysql";
      }
    } else if (typeof input === "object" && input !== null) {
      protocol = input.driver || "mysql";
    }

    let connection;

    switch (protocol) {
      case "mysql":
        connection = await mysql.connect(input);
        break;
      
      case "postgres":
      case "postgresql":
        connection = await postgres.connect(input);
        protocol = "postgres";
        break;

      default:
        throw new Error(`Unsupported Driver : ${protocol}`);
    }

    // Instantiate and store driver-specific QueryBuilder as the active database helper instance
    let qbInstance;
    if (protocol === "mysql") {
      qbInstance = new MySqlQueryBuilder();
    } else if (protocol === "postgres") {
      qbInstance = new PostgresQueryBuilder();
    }

    // Store in active connections dictionary
    Database.connections[dbKey] = qbInstance;

    // Default instance fallback for standard Vexora.query() calls
    if (!Database.instance || dbKey === "default") {
      Database.instance = qbInstance;
    }

    return qbInstance;
  }

  /**
   * Helper to retrieve or automatically connect to a named database based on config URL keys
   */
  static async getConnection(key) {
    if (Database.connections[key]) {
      return Database.connections[key];
    }

    // Load from db_config.json if it exists and has the key
    let dbConfig = null;
    try {
        const root = process.cwd();
        const configPaths = [
            path.join(root, 'db_config.json'),
            path.join(root, '.Vexora', 'db_config.json')
        ];
        for (const p of configPaths) {
            if (fs.existsSync(p)) {
                dbConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
                break;
            }
        }
    } catch (e) {}

    let configData = null;
    if (dbConfig) {
        if (dbConfig[key]) {
            configData = dbConfig[key];
        } else if (key === "default") {
            const keys = Object.keys(dbConfig);
            if (keys.length > 0) {
                configData = dbConfig[keys[0]];
            }
        }
    }

    if (configData) {
        return await Database.connect(configData, key);
    }

    // 1. Throw error if configuration is not found in db_config.json
    throw new Error(`Database configuration missing for key: ${key}`);
  }

  /* ================= STATIC CONNECTION ENGINES DELEGATORS ================= */

  static _resolveArgs(args) {
    let dbKey = "default";
    let actualArgs = [...args];
    
    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
      const firstArg = args[0].trim().toUpperCase();
      // Check if first arg is an SQL query or identifier
      if (
        firstArg.startsWith("SELECT") ||
        firstArg.startsWith("INSERT") ||
        firstArg.startsWith("UPDATE") ||
        firstArg.startsWith("DELETE") ||
        firstArg.includes(" ")
      ) {
        dbKey = "default";
      } else {
        dbKey = args[0];
        actualArgs.shift(); // Remove the dbKey
      }
    }

    return { dbKey, resolved: actualArgs };
  }

  static async query(...args) {
    const { dbKey, resolved } = Database._resolveArgs(args);
    const conn = await Database.getConnection(dbKey);
    return await conn.query(...resolved);
  }

  static async exec(...args) {
    const { dbKey, resolved } = Database._resolveArgs(args);
    const conn = await Database.getConnection(dbKey);
    return await conn.exec(...resolved);
  }

  static async insert(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length === 3 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "object") {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.insert(...resolved);
  }

  static async update(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length >= 4 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "object" && typeof args[3] === "string") {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.update(...resolved);
  }

  static async delete(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "string") {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.delete(...resolved);
  }

  static async upsert(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length === 4 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "object" && typeof args[3] === "object") {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.upsert(...resolved);
  }

  static async count(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string" && (args.length > 2 ? typeof args[2] === "string" : true)) {
      // check if first parameter is not an SQL keyword count query
      const testSql = args[0].trim().toUpperCase();
      if (!testSql.startsWith("SELECT") && !testSql.includes(" ")) {
        dbKey = args[0];
        resolved.shift();
      }
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.count(...resolved);
  }

  static async exists(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "string") {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.exists(...resolved);
  }

  static async fetch(...args) {
    const { dbKey, resolved } = Database._resolveArgs(args);
    const conn = await Database.getConnection(dbKey);
    return await conn.fetch(...resolved);
  }

  static async fetchAll(...args) {
    const { dbKey, resolved } = Database._resolveArgs(args);
    const conn = await Database.getConnection(dbKey);
    return await conn.fetchAll(...resolved);
  }

  static async fetchColumn(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string" && Array.isArray(args[2])) {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.fetchColumn(...resolved);
  }

  static async paginate(...args) {
    let dbKey = "default";
    let resolved = [...args];
    
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string" && Array.isArray(args[2])) {
      dbKey = args[0];
      resolved.shift();
    }
    
    const conn = await Database.getConnection(dbKey);
    return await conn.paginate(...resolved);
  }

  static async begin(dbKey = "default") {
    const conn = await Database.getConnection(dbKey);
    await conn.begin(dbKey);
  }

  static async commit(dbKey = "default") {
    const conn = await Database.getConnection(dbKey);
    await conn.commit(dbKey);
  }

  static async rollback(dbKey = "default") {
    const conn = await Database.getConnection(dbKey);
    await conn.rollback(dbKey);
  }

  static async disconnect() {
    for (const key in Database.connections) {
      const conn = Database.connections[key];
      if (conn.driver === "mysql") {
        await mysql.disconnect();
      } else if (conn.driver === "postgres") {
        await postgres.disconnect();
      }
    }
    Database.connections = {};
    Database.instance = null;
  }
}

export default Database;
