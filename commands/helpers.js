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
