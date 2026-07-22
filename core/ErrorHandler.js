/**
 * ==========================================================
 * Vexora Framework - Error Handler
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

import { log as auditLog } from "../Middleware/audit_logger.js";
import { requestContext } from "./Context.js";

function formatError(error) {
  if (!error) return { message: "Unknown error occurred" };
  const message = error.message || String(error);
  return { error: message };
}

function getErrorInfo(error) {
  const info = {
    file_name: "Unknown",
    line_number: null,
    column_number: null,
    url: null,
    user_id: null,
    device: null
  };

  if (error && error.stack) {
    const lines = error.stack.split("\n");
    const projectLine = lines.find(l => 
      l.includes("at ") && 
      !l.includes("node:") && 
      !l.includes("node_modules") &&
      !l.includes("core/ErrorHandler.js") &&
      !l.includes("core\\ErrorHandler.js")
    );
    if (projectLine) {
      let loc = projectLine.trim().replace(/^at\s+/, "");
      const cwd = process.cwd();
      const normalizedCwd = cwd.replaceAll("\\", "/");
      const fileUrlPrefix = "file:///";
      
      if (loc.startsWith(fileUrlPrefix)) {
        const pathPart = loc.slice(fileUrlPrefix.length);
        if (pathPart.includes(normalizedCwd)) {
          loc = "./" + pathPart.replace(normalizedCwd + "/", "");
        }
      } else {
        const normalizedLoc = loc.replaceAll("\\", "/");
        if (normalizedLoc.includes(normalizedCwd)) {
          loc = "./" + normalizedLoc.replace(normalizedCwd + "/", "");
        }
      }

      // Parse line and column number from location string (e.g. "./Vexora_test.js:4:1")
      const parts = loc.split(":");
      if (parts.length >= 3) {
        const col = parts.pop();
        const line = parts.pop();
        const file = parts.join(":");
        info.file_name = file;
        info.line_number = parseInt(line) || null;
        info.column_number = parseInt(col) || null;
      } else if (parts.length === 2) {
        const line = parts.pop();
        const file = parts.join(":");
        info.file_name = file;
        info.line_number = parseInt(line) || null;
      } else {
        info.file_name = loc;
      }
    }
  }

  // Extract active HTTP request context details if available
  try {
    const store = requestContext.getStore();
    if (store && store.req) {
      info.url = store.req.url || null;
      info.device = store.req.headers["user-agent"] || null;
      
      if (store.req.user && store.req.user.id) {
        info.user_id = store.req.user.id;
      } else if (store.req.user && store.req.user.user_id) {
        info.user_id = store.req.user.user_id;
      } else if (store.req.user && typeof store.req.user === "object") {
        info.user_id = store.req.user.userId || null;
      } else if (store.req._session) {
        info.user_id = store.req._session.user_id || store.req._session.userId || null;
      }
    }
  } catch (ctxErr) {
    // Ignore context reading issues
  }

  return info;
}

export function setupGlobalErrorHandlers() {
  process.on("uncaughtException", (error) => {
    // Safely ignore harmless networking errors where clients close connections early
    if (error && (error.code === 'EPIPE' || error.code === 'ECONNRESET')) {
      return;
    }

    const formatted = formatError(error);
    const errorInfo = getErrorInfo(error);
    
    console.error(`[Vexora Error] Uncaught Exception: ${formatted.error} at ${errorInfo.file_name}:${errorInfo.line_number}:${errorInfo.column_number}`);
    try {
      auditLog("FATAL", "FATAL_ERROR", formatted.error, errorInfo);
    } catch (logErr) {
      console.error("❌ Failed to log uncaught exception:", logErr.message);
    }
  });

  process.on("unhandledRejection", (reason) => {
    const formatted = formatError(reason);
    const errorInfo = getErrorInfo(reason);
    
    console.error(`[Vexora Error] Unhandled Rejection: ${formatted.error} at ${errorInfo.file_name}:${errorInfo.line_number}:${errorInfo.column_number}`);
    try {
      auditLog("ERROR", "RUNTIME_ERROR", formatted.error, errorInfo);
    } catch (logErr) {
      console.error("❌ Failed to log unhandled rejection:", logErr.message);
    }
  });
}
