/**
 * ==========================================================
 * Nyvora Framework
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

export function base64UrlEncode(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    return buf
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

export function base64UrlDecode(data) {
    if (typeof data !== "string") return false;
    let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) {
        base64 += "=".repeat(4 - pad);
    }
    try {
        return Buffer.from(base64, "base64");
    } catch (e) {
        return false;
    }
}
