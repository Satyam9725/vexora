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

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptPayload(key, kid, payloadJsonStr) {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    cipher.setAAD(Buffer.from(kid, "utf8"));

    const encrypted = Buffer.concat([cipher.update(payloadJsonStr, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, encrypted, tag]);
}

export function decryptPayload(key, kid, rawBuffer) {
    if (rawBuffer.length < IV_LEN + TAG_LEN) {
        throw new Error("Corrupted token length.");
    }

    const iv = rawBuffer.subarray(0, IV_LEN);
    const tag = rawBuffer.subarray(rawBuffer.length - TAG_LEN);
    const cipherText = rawBuffer.subarray(IV_LEN, rawBuffer.length - TAG_LEN);

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAAD(Buffer.from(kid, "utf8"));
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decrypted.toString("utf8");
}
