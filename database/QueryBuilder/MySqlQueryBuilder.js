"use strict";

/**
 * ==========================================================
 * Vexora Framework - MySqlQueryBuilder
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
import mysql from "../mysql.js";
import { performance } from "node:perf_hooks";

class MySqlQueryBuilder extends BaseQueryBuilder {
  constructor() {
    super("mysql", "`");
  }

  _getPlaceholders(count) {
    return Array.from({ length: count }, () => '?').join(', ');
  }

  async query(...args) {
    let sql, params;
    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
      sql = args[1];
      params = args[2] || [];
    } else {
      sql = args[0];
      params = args[1] || [];
    }

    const start = performance.now();
    const result = await mysql.query(sql, params);
    const duration = (performance.now() - start) / 1000;

    if (duration > 1) {
      console.warn(`[WARNING] SLOW_QUERY: ${sql} took ${duration.toFixed(2)}s`);
    }

    return result;
  }

  async exec(...args) {
    let sql, params;
    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
      sql = args[1];
      params = args[2] || [];
    } else {
      sql = args[0];
      params = args[1] || [];
    }

    const result = await mysql.execute(sql, params);
    return result.affectedRows || 0;
  }

  _parseParams(paramVal) {
    if (paramVal === undefined || paramVal === null) return [];
    return Array.isArray(paramVal) ? paramVal : [paramVal];
  }

  async insert(...args) {
    let table, data;
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "object") {
      table = args[1];
      data = args[2];
    } else if (typeof args[0] === "string" && typeof args[1] === "object" && args[1] !== null) {
      table = args[0];
      data = args[1];
    } else {
      throw new Error(`Invalid arguments provided to insert(). Expected (table, data) or (dbKey, table, data).`);
    }

    const quotedTable = this._quoteIdentifier(table);
    const columns = Object.keys(data);
    const quotedColumns = columns.map(c => this._quoteIdentifier(c));
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${quotedTable} (${quotedColumns.join(', ')}) VALUES (${this._getPlaceholders(columns.length)})`;
    const result = await mysql.execute(sql, values);
    return result.insertId || 0;
  }

  async update(...args) {
    let table, data, where = '', params = [];
    if (args.length >= 4 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "object") {
      table = args[1];
      data = args[2];
      where = args[3] || '';
      params = this._parseParams(args[4]);
    } else if (typeof args[0] === "string" && typeof args[1] === "object" && args[1] !== null) {
      table = args[0];
      data = args[1];
      where = args[2] || '';
      params = this._parseParams(args[3]);
    } else {
      throw new Error(`Invalid arguments provided to update(). Expected (table, data, where, params) or (dbKey, table, data, where, params).`);
    }

    const quotedTable = this._quoteIdentifier(table);
    const columns = Object.keys(data);
    const setClauses = [];
    const values = Object.values(data);

    columns.forEach(col => {
      setClauses.push(`${this._quoteIdentifier(col)} = ?`);
    });

    const sql = where ? `UPDATE ${quotedTable} SET ${setClauses.join(', ')} WHERE ${where}` : `UPDATE ${quotedTable} SET ${setClauses.join(', ')}`;
    const result = await mysql.execute(sql, [...values, ...params]);
    return result.affectedRows || 0;
  }

  async delete(...args) {
    let table, where = '', params = [];
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "string") {
      table = args[1];
      where = args[2];
      params = this._parseParams(args[3]);
    } else if (typeof args[0] === "string") {
      table = args[0];
      where = args[1] || '';
      params = this._parseParams(args[2]);
    } else {
      throw new Error(`Invalid arguments provided to delete(). Expected (table, where, params) or (dbKey, table, where, params).`);
    }

    const quotedTable = this._quoteIdentifier(table);
    const sql = where ? `DELETE FROM ${quotedTable} WHERE ${where}` : `DELETE FROM ${quotedTable}`;
    const result = await mysql.execute(sql, params);
    return result.affectedRows || 0;
  }

  async upsert(...args) {
    let table, insertData, updateData;
    if (args.length >= 4 && typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "object") {
      table = args[1];
      insertData = args[2];
      updateData = args[3];
    } else if (typeof args[0] === "string" && typeof args[1] === "object" && typeof args[2] === "object") {
      table = args[0];
      insertData = args[1];
      updateData = args[2];
    } else {
      throw new Error(`Invalid arguments provided to upsert().`);
    }

    const quotedTable = this._quoteIdentifier(table);
    const insertCols = Object.keys(insertData);
    const quotedInsertCols = insertCols.map(c => this._quoteIdentifier(c));
    const updateCols = Object.keys(updateData);
    const params = [...Object.values(insertData), ...Object.values(updateData)];

    const updateSets = updateCols.map(col => `${this._quoteIdentifier(col)} = ?`);
    const sql = `INSERT INTO ${quotedTable} (${quotedInsertCols.join(', ')}) 
           VALUES (${this._getPlaceholders(insertCols.length)})
           ON DUPLICATE KEY UPDATE ${updateSets.join(', ')}`;

    const result = await mysql.execute(sql, params);
    return result.insertId || 0;
  }

  async paginate(...args) {
    let sql, params, page = 1, limit = 10;
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string") {
      sql = args[1];
      params = args[2] || [];
      page = args[3] || 1;
      limit = args[4] || 10;
    } else {
      sql = args[0];
      params = args[1] || [];
      page = args[2] || 1;
      limit = args[3] || 10;
    }

    page = Math.max(1, page);
    limit = Math.max(1, limit);
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS count_query`;
    const totalItems = parseInt(await this.fetchColumn(countSql, params)) || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
    const paginatedParams = [...params, limit, offset];

    const items = await this.fetchAll(paginatedSql, paginatedParams);

    return {
      items,
      total_items: totalItems,
      current_page: page,
      total_pages: totalPages,
      limit,
      has_next: page < totalPages,
      has_prev: page > 1
    };
  }

  async begin(dbKey = "default") {
    const level = this.transactionLevels[dbKey] || 0;
    if (level === 0) {
      await this.query("START TRANSACTION");
    } else {
      await this.query(`SAVEPOINT trans${level}`);
    }
    this.transactionLevels[dbKey] = level + 1;
  }

  async commit(dbKey = "default") {
    const level = this.transactionLevels[dbKey] || 0;
    if (level <= 0) {
      throw new Error("No active transaction to commit");
    }
    if (level === 1) {
      await this.query("COMMIT");
    } else {
      const saveLevel = level - 1;
      await this.query(`RELEASE SAVEPOINT trans${saveLevel}`);
    }
    this.transactionLevels[dbKey] = level - 1;
  }

  async rollback(dbKey = "default") {
    const level = this.transactionLevels[dbKey] || 0;
    if (level <= 0) return;
    if (level === 1) {
      await this.query("ROLLBACK");
    } else {
      const saveLevel = level - 1;
      await this.query(`ROLLBACK TO SAVEPOINT trans${saveLevel}`);
    }
    this.transactionLevels[dbKey] = level - 1;
  }
}

export default MySqlQueryBuilder;
