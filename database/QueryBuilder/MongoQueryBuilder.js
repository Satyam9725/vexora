"use strict";

/**
 * ==========================================================
 * Vexora Framework - MongoDB Unified QueryBuilder
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
import mongodb from "../mongodb.js";

class MongoQueryBuilder extends BaseQueryBuilder {
  constructor() {
    super("mongodb", "");
    this._tableName = "";
    this._whereQuery = {};
    this._limit = null;
    this._skip = null;
    this._sort = {};
  }

  table(name) {
    const instance = new MongoQueryBuilder();
    instance._tableName = name;
    return instance;
  }

  where(field, operatorOrValue, val) {
    let operator = "=";
    let value = operatorOrValue;

    if (val !== undefined) {
      operator = operatorOrValue;
      value = val;
    }

    if (operator === "=" || operator === "==") {
      this._whereQuery[field] = value;
    } else if (operator === ">") {
      this._whereQuery[field] = { $gt: value };
    } else if (operator === ">=") {
      this._whereQuery[field] = { $gte: value };
    } else if (operator === "<") {
      this._whereQuery[field] = { $lt: value };
    } else if (operator === "<=") {
      this._whereQuery[field] = { $lte: value };
    } else if (operator === "!=" || operator === "<>") {
      this._whereQuery[field] = { $ne: value };
    } else if (operator.toLowerCase() === "in" && Array.isArray(value)) {
      this._whereQuery[field] = { $in: value };
    } else if (operator.toLowerCase() === "like") {
      const regexStr = String(value).replace(/%/g, ".*");
      this._whereQuery[field] = { $regex: new RegExp(regexStr, "i") };
    } else {
      this._whereQuery[field] = value;
    }

    return this;
  }

  limit(count) {
    this._limit = count;
    return this;
  }

  offset(count) {
    this._skip = count;
    return this;
  }

  orderBy(field, direction = "asc") {
    this._sort[field] = direction.toLowerCase() === "desc" ? -1 : 1;
    return this;
  }

  async get() {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected. Call Vexora.DB.connect() first.");

    let cursor = db.collection(this._tableName).find(this._whereQuery);
    if (Object.keys(this._sort).length > 0) cursor = cursor.sort(this._sort);
    if (this._skip) cursor = cursor.skip(this._skip);
    if (this._limit) cursor = cursor.limit(this._limit);

    return await cursor.toArray();
  }

  async first() {
    this._limit = 1;
    const res = await this.get();
    return res && res.length > 0 ? res[0] : null;
  }

  async getNextSequence(db, collectionName) {
    try {
      const res = await db.collection("counters").findOneAndUpdate(
        { _id: collectionName },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
      );
      const doc = res && res.value ? res.value : res;
      return doc && typeof doc.seq === "number" ? doc.seq : 1;
    } catch {
      return Date.now();
    }
  }

  async insert(...args) {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected.");

    let table = this._tableName;
    let data = args[0];

    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "object") {
      table = args[0];
      data = args[1];
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === "object" && item !== null && item.id === undefined && item._id === undefined) {
          const seq = await this.getNextSequence(db, table);
          item._id = seq;
          item.id = seq;
        }
      }
      const res = await db.collection(table).insertMany(data);
      return Object.values(res.insertedIds);
    }

    if (typeof data === "object" && data !== null && data.id === undefined && data._id === undefined) {
      const seq = await this.getNextSequence(db, table);
      data._id = seq;
      data.id = seq;
    }

    const res = await db.collection(table).insertOne(data);
    return res.insertedId ? String(res.insertedId) : 1;
  }

  async _parseIdFilter(val) {
    if (typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val)) {
      try {
        const { ObjectId } = await import("mongodb");
        return { _id: new ObjectId(val) };
      } catch {
        // ignore
      }
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      return { $or: [{ id: num }, { _id: num }, { id: String(val) }, { _id: String(val) }] };
    }
    return { $or: [{ id: val }, { _id: val }] };
  }

  async update(...args) {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected.");

    let table = this._tableName;
    let data = {};
    let filter = this._whereQuery;

    if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "object") {
      table = args[0];
      data = args[1];
      if (typeof args[2] === "string") {
        const whereMatch = args[2].match(/([`"a-zA-Z0-9_]+)\s*=\s*\?/i);
        const params = Array.isArray(args[3]) ? args[3] : [];
        if (whereMatch && params.length > 0) {
          const field = whereMatch[1].replace(/[`"]/g, "");
          const val = params[0];
          if (field.toLowerCase() === "id") {
            filter = await this._parseIdFilter(val);
          } else {
            filter = { [field]: val };
          }
        } else if (Array.isArray(args[3]) && args[3].length > 0) {
          filter = await this._parseIdFilter(args[3][0]);
        }
      } else if (typeof args[2] === "object") {
        filter = args[2];
      }
    } else if (typeof args[0] === "object") {
      data = args[0];
    }

    const res = await db.collection(table).updateMany(filter, { $set: data });
    return res.modifiedCount || res.matchedCount || 0;
  }

  async delete(...args) {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected.");

    let table = this._tableName;
    let filter = this._whereQuery;

    if (args.length >= 2 && typeof args[0] === "string") {
      table = args[0];
      if (typeof args[1] === "string") {
        const whereMatch = args[1].match(/([`"a-zA-Z0-9_]+)\s*=\s*\?/i);
        const params = Array.isArray(args[2]) ? args[2] : [];
        if (whereMatch && params.length > 0) {
          const field = whereMatch[1].replace(/[`"]/g, "");
          const val = params[0];
          if (field.toLowerCase() === "id") {
            filter = await this._parseIdFilter(val);
          } else {
            filter = { [field]: val };
          }
        } else if (Array.isArray(args[2]) && args[2].length > 0) {
          filter = await this._parseIdFilter(args[2][0]);
        }
      } else if (typeof args[1] === "object") {
        filter = args[1];
      }
    }

    const res = await db.collection(table).deleteMany(filter);
    return res.deletedCount || 0;
  }

  async upsert(...args) {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected.");

    let table = this._tableName;
    let data = {};

    if (args.length >= 2 && typeof args[0] === "string") {
      table = args[0];
      data = args[1];
    } else if (typeof args[0] === "object") {
      data = args[0];
    }

    const filter = data._id ? { _id: data._id } : (data.email ? { email: data.email } : (data.id ? { id: data.id } : data));
    const res = await db.collection(table).updateOne(filter, { $set: data }, { upsert: true });
    return res.upsertedCount || res.modifiedCount || 1;
  }

  async count(...args) {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected.");

    let table = this._tableName;
    let filter = this._whereQuery;

    if (args.length >= 1 && typeof args[0] === "string") {
      table = args[0];
      if (typeof args[1] === "string") {
        const whereMatch = args[1].match(/([`"a-zA-Z0-9_]+)\s*=\s*\?/i);
        const params = Array.isArray(args[2]) ? args[2] : [];
        if (whereMatch && params.length > 0) {
          const field = whereMatch[1].replace(/[`"]/g, "");
          const val = params[0];
          if (field.toLowerCase() === "id") {
            filter = await this._parseIdFilter(val);
          } else {
            filter = { [field]: val };
          }
        } else if (Array.isArray(args[2]) && args[2].length > 0) {
          filter = { status: args[2][0] };
        }
      } else if (typeof args[1] === "object") {
        filter = args[1];
      }
    }

    return await db.collection(table).countDocuments(filter);
  }

  async exists(...args) {
    const total = await this.count(...args);
    return total > 0;
  }

  async fetch(...args) {
    const rows = await this.fetchAll(...args);
    return (rows && rows.length > 0) ? rows[0] : null;
  }

  async fetchAll(...args) {
    return await this.query(...args);
  }

  async fetchColumn(...args) {
    const row = await this.fetch(...args);
    if (!row) return null;
    const keys = Object.keys(row);
    return row[keys[0]] !== undefined ? row[keys[0]] : null;
  }

  async exec(...args) {
    return await this.query(...args);
  }

  async paginate(...args) {
    let table = this._tableName;
    let filter = {};
    let page = 1;
    let perPage = 10;

    if (typeof args[0] === "string") {
      const sql = args[0];
      const fromMatch = sql.match(/FROM\s+([`"a-zA-Z0-9_]+)/i);
      if (fromMatch) {
        table = fromMatch[1].replace(/[`"]/g, "");
      } else {
        table = sql;
      }
      
      const whereMatch = sql.match(/WHERE\s+([`"a-zA-Z0-9_]+)\s*=\s*\?/i);
      if (whereMatch && Array.isArray(args[1]) && args[1].length > 0) {
        const field = whereMatch[1].replace(/[`"]/g, "");
        filter = { [field]: args[1][0] };
      } else if (Array.isArray(args[1])) {
        if (args[1].length > 0) {
          filter = { status: args[1][0] };
        }
      } else if (typeof args[1] === "object" && args[1] !== null) {
        filter = args[1];
      }
      page = parseInt(args[2]) || 1;
      perPage = parseInt(args[3]) || 10;
    }

    const total = await this.count(table, filter);
    const db = mongodb.getDb();
    const skip = (page - 1) * perPage;

    const items = await db.collection(table).find(filter).skip(skip).limit(perPage).toArray();
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

  async query(sqlOrCollection, params = []) {
    const db = mongodb.getDb();
    if (!db) throw new Error("MongoDB not connected.");

    let collectionName = sqlOrCollection;
    let queryFilter = {};

    if (typeof sqlOrCollection === "string" && sqlOrCollection.toUpperCase().startsWith("SELECT")) {
      const fromMatch = sqlOrCollection.match(/FROM\s+([`"a-zA-Z0-9_]+)/i);
      if (fromMatch) {
        collectionName = fromMatch[1].replace(/[`"]/g, "");
      }
      
      const whereMatch = sqlOrCollection.match(/WHERE\s+([`"a-zA-Z0-9_]+)\s*=\s*\?/i);
      if (whereMatch && Array.isArray(params) && params.length > 0) {
        const field = whereMatch[1].replace(/[`"]/g, "");
        const val = params[0];
        if (field.toLowerCase() === "id") {
          queryFilter = await this._parseIdFilter(val);
        } else {
          queryFilter = { [field]: val };
        }
      } else if (Array.isArray(params) && params.length > 0) {
        queryFilter = { status: params[0] };
        if (typeof params[0] === "number") {
          queryFilter = await this._parseIdFilter(params[0]);
        }
      }
    } else if (typeof params === "object" && !Array.isArray(params)) {
      queryFilter = params;
    } else if (Array.isArray(params) && params[0] && typeof params[0] === "object") {
      queryFilter = params[0];
    }

    return await db.collection(collectionName).find(queryFilter).toArray();
  }
}

export default MongoQueryBuilder;
