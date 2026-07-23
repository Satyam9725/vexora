/**
 * Vexora Framework - CLI Helpers & Shared Utilities
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export const SUPPORTED_DB_DRIVERS = ["mysql", "postgres"];

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  brightCyan: "\x1b[96m",
  green: "\x1b[32m",
  brightGreen: "\x1b[92m",
  yellow: "\x1b[33m",
  brightYellow: "\x1b[93m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m"
};

export function stripAnsi(str) {
  return str
    .replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\uFE0E|\uFE0F/g, "");
}

export function getDisplayWidth(str) {
  const clean = stripAnsi(str);
  let width = 0;
  for (const char of clean) {
    const cp = char.codePointAt(0);
    if ((cp >= 0x1F300 && cp <= 0x1F9FF) || (cp >= 0x2600 && cp <= 0x26FF) || (cp >= 0x2700 && cp <= 0x27BF)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function padDisplayEnd(str, targetWidth) {
  const currentW = getDisplayWidth(str);
  const padLen = Math.max(0, targetWidth - currentW);
  return str + " ".repeat(padLen);
}

export function renderConsoleTable(rows) {
  const c = colors;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    console.log("  (Empty dataset)");
    return;
  }

  const columns = Object.keys(rows[0]);
  const colWidths = {};

  for (const col of columns) {
    colWidths[col] = getDisplayWidth(col);
  }

  for (const row of rows) {
    for (const col of columns) {
      const valStr = row[col] === null || row[col] === undefined ? "null" : String(row[col]);
      colWidths[col] = Math.max(colWidths[col], getDisplayWidth(valStr));
    }
  }

  for (const col of columns) {
    colWidths[col] = Math.min(Math.max(colWidths[col], 4), 40);
  }

  const topBorder = columns.map(col => "─".repeat(colWidths[col] + 2)).join("┬");
  console.log(`  ${c.gray}┌${topBorder}┐${c.reset}`);

  const headerCells = columns.map(col => padDisplayEnd(` ${col}`, colWidths[col] + 2));
  console.log(`  ${c.gray}│${c.reset}${c.bold}${c.brightCyan}${headerCells.join(`${c.reset}${c.gray}│${c.reset}${c.bold}${c.brightCyan}`)}${c.reset}${c.gray}│${c.reset}`);

  const midBorder = columns.map(col => "─".repeat(colWidths[col] + 2)).join("┼");
  console.log(`  ${c.gray}├${midBorder}┤${c.reset}`);

  for (const row of rows) {
    const rowCells = columns.map(col => {
      let rawVal = row[col];
      let valStr = rawVal === null || rawVal === undefined ? "null" : String(rawVal);
      if (valStr.length > colWidths[col]) {
        valStr = valStr.substring(0, colWidths[col] - 2) + "..";
      }
      return padDisplayEnd(` ${valStr}`, colWidths[col] + 2);
    });
    console.log(`  ${c.gray}│${c.reset}${rowCells.join(`${c.gray}│${c.reset}`)}${c.gray}│${c.reset}`);
  }

  const botBorder = columns.map(col => "─".repeat(colWidths[col] + 2)).join("┴");
  console.log(`  ${c.gray}└${botBorder}┘${c.reset}`);
}

export function promptQuestion(query, defaultValue = "") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    const promptText = defaultValue
      ? `👉 ${query} [${defaultValue}]: `
      : `👉 ${query}: `;
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

export function rootDir() {
  return process.cwd();
}
export function vexoraConfigDir() {
  return path.join(rootDir(), ".vexora_config");
}
export function apiRoutesDir() {
  return path.join(rootDir(), ".api_routes");
}
export function dbConfigPath() {
  return path.join(vexoraConfigDir(), "db_config.json");
}
export function controllersDir() {
  return path.join(rootDir(), "controllers");
}
export function middlewareDir() {
  return path.join(rootDir(), "Middleware");
}
export function queueDir() {
  return path.join(rootDir(), "queue");
}
export function logsDir() {
  return path.join(rootDir(), ".vexora_log");
}

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readDbConfig() {
  const p = dbConfigPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

export function writeDbConfig(configs) {
  ensureDir(vexoraConfigDir());
  fs.writeFileSync(dbConfigPath(), JSON.stringify(configs, null, 2), "utf8");
}

export function line() {
  console.log("==========================================");
}
