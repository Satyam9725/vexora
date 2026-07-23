"use strict";

/**
 * ==========================================================
 * Vexora Framework - SQLite Unified QueryBuilder
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

import BaseQueryBuilder from "./BaseQueryBuilder.js";
import sqlite from "../sqlite.js";

class SqliteQueryBuilder extends BaseQueryBuilder {
  constructor() {
    super("sqlite", "`");
  }

  table(name) {
    const instance = new SqliteQueryBuilder();
    instance._tableName = name;
    return instance;
  }

  async query(sql, params = []) {
    return await sqlite.query(sql, params);
  }

  async exec(sql, params = []) {
    return await sqlite.execute(sql, params);
  }

  async insert(...args) {
    let table = this._tableName;
    let data = args[0];

    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "object") {
      table = args[0];
      data = args[1];
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");
    const quotedKeys = keys.map(k => `\`${k}\``).join(", ");

    const sql = `INSERT INTO \`${table}\` (${quotedKeys}) VALUES (${placeholders})`;
    const res = await sqlite.query(sql, values);
    return res && res.lastInsertRowid !== undefined ? res.lastInsertRowid : 1;
  }

  async update(...args) {
    let table = this._tableName;
    let data = {};
    let whereClause = "";
    let params = [];

    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "object") {
      table = args[0];
      data = args[1];
      whereClause = args[2] || "";
      params = args[3] || [];
    } else if (typeof args[0] === "object") {
      data = args[0];
    }

    const setClause = Object.keys(data).map(k => `\`${k}\` = ?`).join(", ");
    const values = [...Object.values(data), ...params];

    let sql = `UPDATE \`${table}\` SET ${setClause}`;
    if (whereClause) sql += ` WHERE ${whereClause}`;

    const res = await sqlite.query(sql, values);
    return res && res.changes !== undefined ? res.changes : 1;
  }

  async delete(...args) {
    let table = this._tableName;
    let whereClause = "";
    let params = [];

    if (args.length >= 1 && typeof args[0] === "string") {
      table = args[0];
      whereClause = args[1] || "";
      params = args[2] || [];
    }

    let sql = `DELETE FROM \`${table}\``;
    if (whereClause) sql += ` WHERE ${whereClause}`;

    const res = await sqlite.query(sql, params);
    return res && res.changes !== undefined ? res.changes : 1;
  }

  async upsert(...args) {
    let table = this._tableName;
    let data = {};

    if (args.length >= 2 && typeof args[0] === "string") {
      table = args[0];
      data = args[1];
    } else if (typeof args[0] === "object") {
      data = args[0];
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(", ");
    const quotedKeys = keys.map(k => `\`${k}\``).join(", ");
    const updateClause = keys.map(k => `\`${k}\` = excluded.\`${k}\``).join(", ");

    const sql = `INSERT INTO \`${table}\` (${quotedKeys}) VALUES (${placeholders}) ON CONFLICT DO UPDATE SET ${updateClause}`;
    const res = await sqlite.query(sql, values);
    return res && res.changes !== undefined ? res.changes : 1;
  }

  async paginate(...args) {
    let sql = "";
    let params = [];
    let page = 1;
    let perPage = 10;

    if (typeof args[0] === "string") {
      sql = args[0];
      params = Array.isArray(args[1]) ? args[1] : [];
      page = parseInt(args[2]) || 1;
      perPage = parseInt(args[3]) || 10;
    }

    const totalSql = `SELECT COUNT(*) AS total FROM (${sql})`;
    const countRes = await sqlite.query(totalSql, params);
    const total = countRes && countRes.length > 0 ? (countRes[0].total || countRes[0]["COUNT(*)"] || 0) : 0;

    const offset = (page - 1) * perPage;
    const paginatedSql = `${sql} LIMIT ${perPage} OFFSET ${offset}`;
    const items = await sqlite.query(paginatedSql, params);
    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      total_items: total,
      total_pages: totalPages,
      current_page: page,
      per_page: perPage,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  }
}

export default SqliteQueryBuilder;
