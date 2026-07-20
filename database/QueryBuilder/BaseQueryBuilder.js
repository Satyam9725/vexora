"use strict";

/**
 * ==========================================================
 * Vexora Framework - Base QueryBuilder
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

class BaseQueryBuilder {
  constructor(driver, quoteChar) {
    this.driver = driver;
    this.quoteChar = quoteChar;
    this.transactionLevels = {};
  }

  /* ================= UTILS & SECURITY ================= */

  _quoteIdentifier(name) {
    const parts = name.split('.');
    const mapped = parts.map(part => {
      if (!/^[a-zA-Z0-9_]+$/.test(part)) {
        throw new Error(`Invalid database identifier: ${part}`);
      }
      return `${this.quoteChar}${part.replace(new RegExp(this.quoteChar, 'g'), this.quoteChar + this.quoteChar)}${this.quoteChar}`;
    });
    return mapped.join('.');
  }

  /* ================= SHARED READ READ-ONLY OPERATIONS ================= */

  async count(...args) {
    let table, where = '', params = [];
    if (args.length >= 2 && typeof args[1] === "string") {
      table = args[1];
      where = args[2] || '';
      params = args[3] || [];
    } else {
      table = args[0];
      where = args[1] || '';
      params = args[2] || [];
    }

    const quotedTable = this._quoteIdentifier(table);
    let sql = `SELECT COUNT(*) AS total FROM ${quotedTable}`;
    if (where) {
      sql += ` WHERE ${where}`;
    }
    const val = await this.fetchColumn(sql, params);
    return parseInt(val) || 0;
  }

  async exists(...args) {
    let table, where, params = [];
    if (args.length >= 3 && typeof args[1] === "string" && typeof args[2] === "string") {
      table = args[1];
      where = args[2];
      params = args[3] || [];
    } else {
      table = args[0];
      where = args[1];
      params = args[2] || [];
    }

    const quotedTable = this._quoteIdentifier(table);
    const sql = `SELECT 1 FROM ${quotedTable} WHERE ${where} LIMIT 1`;
    const res = await this.fetch(sql, params);
    return res !== null;
  }

  async fetch(...args) {
    let sql, params;
    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
      sql = args[1];
      params = args[2] || [];
    } else {
      sql = args[0];
      params = args[1] || [];
    }
    const rows = await this.query(sql, params);
    return (rows && rows.length > 0) ? rows[0] : null;
  }

  async fetchAll(...args) {
    let sql, params;
    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
      sql = args[1];
      params = args[2] || [];
    } else {
      sql = args[0];
      params = args[1] || [];
    }
    return await this.query(sql, params);
  }

  async fetchColumn(...args) {
    let sql, params, columnNumber = 0;
    if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string") {
      sql = args[1];
      params = args[2] || [];
      columnNumber = args[3] || 0;
    } else {
      sql = args[0];
      params = args[1] || [];
      columnNumber = args[2] || 0;
    }
    const row = await this.fetch(sql, params);
    if (!row) return null;
    const keys = Object.keys(row);
    return row[keys[columnNumber]] !== undefined ? row[keys[columnNumber]] : null;
  }
}

export default BaseQueryBuilder;
