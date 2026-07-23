/**
 * ==========================================================
 * Vexora Encryption Engine — Ultra-Advanced Polymorphic Cipher
 * ==========================================================
 * Dynamic 6-Layer Polymorphic Cipher Matrix featuring:
 * - 4,096-Element Astronomical S-Box Substitution Matrix (>8,000 JSON lines)
 * - 10,000+ Character High-Entropy Custom Master Key (custom_key)
 * - User Custom Key Binding & Auto-Padding
 * - Dynamic HMAC-SHA512 Signature Binding
 * - Variable Bitwise Rotation & Key Stream XOR
 * - AES-256-GCM Authenticated Cipher
 *
 * @author      Satyam Kumar
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 * ==========================================================
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SBOX_SIZE = 4096; // 4096-element Astronomical Substitution Matrix
const TARGET_KEY_LEN = 10000; // 10,000+ character minimum key length

class PolymorphicCipher {
  constructor() {
    this.configPath = path.join(process.cwd(), ".vexora_config", "polymorphic_cipher.json");
    this.cipherMatrix = null;
    this._loadOrGenerateMatrix();
  }

  /**
   * Helper to bind user's custom key and pad to 10,000+ characters
   */
  _bindAndPadKey(userKey) {
    const baseKey = String(userKey || "VEXORA_MASTER_SECRET_KEY");
    if (baseKey.length >= TARGET_KEY_LEN) {
      return baseKey;
    }

    const neededBytes = Math.ceil((TARGET_KEY_LEN - baseKey.length) / 2);
    const padding = crypto.pbkdf2Sync(baseKey, "VexoraKeyPaddingSalt2026", 1000, neededBytes, "sha512").toString("hex");
    
    return baseKey + padding;
  }

  /**
   * Load existing file or auto-generate ONLY if missing
   */
  _loadOrGenerateMatrix() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf8");
        this.cipherMatrix = JSON.parse(raw);

        // Normalize custom_key spelling if present
        let rawKey = this.cipherMatrix.custom_key || this.cipherMatrix.custum_kye;
        if (rawKey) {
          this.cipherMatrix.custom_key = this._bindAndPadKey(rawKey);
          delete this.cipherMatrix.custum_kye;
        }
      } else {
        // Create brand new matrix ONLY if file does not exist
        this.cipherMatrix = this._generateUniqueMatrix("ewewqeqe");
        this.saveMatrix();
      }
    } catch (e) {
      if (!this.cipherMatrix) {
        this.cipherMatrix = this._generateUniqueMatrix("ewewqeqe");
      }
    }
  }

  /**
   * Safely reset and regenerate Polymorphic Cipher Matrix with backup
   */
  resetMatrix(userKey = "ewewqeqe") {
    let backupPath = null;
    if (fs.existsSync(this.configPath)) {
      backupPath = `${this.configPath}.bak_${Date.now()}`;
      try {
        fs.copyFileSync(this.configPath, backupPath);
      } catch (e) {
        // Backup warning
      }
    }

    this.cipherMatrix = this._generateUniqueMatrix(userKey);
    this.saveMatrix();

    return {
      success: true,
      backup_path: backupPath,
      matrix_id: this.cipherMatrix.matrix_id,
      s_box_size: this.cipherMatrix.s_box.length,
      custom_key_length: this.cipherMatrix.custom_key.length
    };
  }

  /**
   * Persist current matrix to .vexora_config/polymorphic_cipher.json with custom_key ON TOP
   */
  saveMatrix() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const orderedObj = {
        custom_key: this.cipherMatrix.custom_key,
        matrix_id: this.cipherMatrix.matrix_id,
        created_at: this.cipherMatrix.created_at,
        bit_shift: this.cipherMatrix.bit_shift,
        pbkdf2_rounds: this.cipherMatrix.pbkdf2_rounds,
        master_pepper: this.cipherMatrix.master_pepper,
        s_box: this.cipherMatrix.s_box,
        inv_s_box: this.cipherMatrix.inv_s_box
      };

      fs.writeFileSync(this.configPath, JSON.stringify(orderedObj, null, 2), "utf8");
    } catch (e) {
      // Ignore filesystem errors if read-only
    }
  }

  /**
   * Dynamically update custom_key with user string bound into 10,000+ char master key
   */
  setCustomKey(newKey) {
    if (!newKey) throw new Error("Custom key cannot be empty");
    this.cipherMatrix.custom_key = this._bindAndPadKey(newKey);
    this.saveMatrix();
    return true;
  }

  /**
   * Generate unique 4,096-element S-Box Permutation Matrix
   */
  _generateUniqueMatrix(userKey = "") {
    const sBox = Array.from({ length: SBOX_SIZE }, (_, i) => i);
    for (let i = SBOX_SIZE - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [sBox[i], sBox[j]] = [sBox[j], sBox[i]];
    }

    const invSBox = new Array(SBOX_SIZE);
    for (let i = 0; i < SBOX_SIZE; i++) {
      invSBox[sBox[i]] = i;
    }

    const bitShift = crypto.randomInt(1, 7);
    const pbkdf2Rounds = crypto.randomInt(100000, 200000);
    const masterPepper = crypto.randomBytes(32).toString("hex");
    const customKey = this._bindAndPadKey(userKey || crypto.randomBytes(32).toString("hex"));
    const matrixId = "VEXORA_POLY_CIPHER_" + crypto.randomBytes(8).toString("hex");

    return {
      custom_key: customKey,
      matrix_id: matrixId,
      created_at: new Date().toISOString(),
      bit_shift: bitShift,
      pbkdf2_rounds: pbkdf2Rounds,
      master_pepper: masterPepper,
      s_box: sBox,
      inv_s_box: invSBox
    };
  }

  /**
   * Computes dynamic HMAC-SHA512 signature for payload integrity
   */
  _computeHmac(buffer) {
    const hmacKey = (this.cipherMatrix.custom_key || "") + this.cipherMatrix.master_pepper + this.cipherMatrix.matrix_id;
    return crypto.createHmac("sha512", hmacKey).update(buffer).digest().subarray(0, 32);
  }

  /**
   * Encrypt data using 10,000+ char custom_key & 4,096 S-Box Dynamic Engine
   */
  encrypt(plainText, userSecret = "") {
    if (plainText === undefined || plainText === null) throw new Error("Data to encrypt cannot be empty");

    const textStr = typeof plainText === "object" ? JSON.stringify(plainText) : String(plainText);
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    const customKey = this.cipherMatrix.custom_key || "";
    const keyMaterial = userSecret + customKey + this.cipherMatrix.master_pepper + this.cipherMatrix.matrix_id;

    const derivedKey = crypto.pbkdf2Sync(
      keyMaterial,
      salt,
      this.cipherMatrix.pbkdf2_rounds,
      32,
      "sha512"
    );

    const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);
    let encrypted = cipher.update(textStr, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    const rawPayload = Buffer.concat([salt, iv, authTag, encrypted]);

    const hmacSig = this._computeHmac(rawPayload);
    const signedPayload = Buffer.concat([hmacSig, rawPayload]);

    const substituted = Buffer.alloc(signedPayload.length);
    const sBox = this.cipherMatrix.s_box;

    for (let i = 0; i < signedPayload.length; i++) {
      const b = signedPayload[i];
      const sIndex = (i * 37) % SBOX_SIZE;
      substituted[i] = (b ^ (sBox[sIndex] & 0xff)) & 0xff;
    }

    const shift = this.cipherMatrix.bit_shift;
    const pepperKey = customKey + this.cipherMatrix.master_pepper;

    for (let i = 0; i < substituted.length; i++) {
      let b = substituted[i];
      b = ((b << shift) | (b >>> (8 - shift))) & 0xff;
      b ^= pepperKey.charCodeAt(i % pepperKey.length);
      substituted[i] = b;
    }

    return substituted.toString("base64url");
  }

  /**
   * Decrypt data using 10,000+ char custom_key & 4,096 S-Box Dynamic Engine
   */
  decrypt(cipherTextBase64, userSecret = "") {
    if (!cipherTextBase64) throw new Error("Ciphertext cannot be empty");

    let buffer = Buffer.from(String(cipherTextBase64), "base64url");

    const shift = this.cipherMatrix.bit_shift;
    const customKey = this.cipherMatrix.custom_key || "";
    const pepperKey = customKey + this.cipherMatrix.master_pepper;

    for (let i = 0; i < buffer.length; i++) {
      let b = buffer[i];
      b ^= pepperKey.charCodeAt(i % pepperKey.length);
      b = ((b >>> shift) | (b << (8 - shift))) & 0xff;
      buffer[i] = b;
    }

    const sBox = this.cipherMatrix.s_box;
    const signedPayload = Buffer.alloc(buffer.length);

    for (let i = 0; i < buffer.length; i++) {
      const sIndex = (i * 37) % SBOX_SIZE;
      const b = (buffer[i] ^ (sBox[sIndex] & 0xff)) & 0xff;
      signedPayload[i] = b;
    }

    const hmacSig = signedPayload.subarray(0, 32);
    const rawPayload = signedPayload.subarray(32);

    const expectedHmac = this._computeHmac(rawPayload);
    if (!crypto.timingSafeEqual(hmacSig, expectedHmac)) {
      throw new Error("❌ Decryption Failed: Invalid ciphertext signature or corrupted key matrix.");
    }

    const salt = rawPayload.subarray(0, 16);
    const iv = rawPayload.subarray(16, 28);
    const authTag = rawPayload.subarray(28, 44);
    const encryptedText = rawPayload.subarray(44);

    const keyMaterial = userSecret + customKey + this.cipherMatrix.master_pepper + this.cipherMatrix.matrix_id;
    const derivedKey = crypto.pbkdf2Sync(
      keyMaterial,
      salt,
      this.cipherMatrix.pbkdf2_rounds,
      32,
      "sha512"
    );

    const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const resultStr = decrypted.toString("utf8");
    try {
      return JSON.parse(resultStr);
    } catch {
      return resultStr;
    }
  }

  /**
   * Returns current installation's unique matrix details (Strictly sanitized)
   */
  getMatrixInfo() {
    return {
      matrix_id: this.cipherMatrix ? this.cipherMatrix.matrix_id : "uninitialized",
      status: "active_secured",
      algorithm: "VEXORA_POLYMORPHIC_6LAYER_GCM",
      is_custom_key_bound: Boolean(this.cipherMatrix && this.cipherMatrix.custom_key)
    };
  }
}

const polymorphicCipherInstance = new PolymorphicCipher();
export default polymorphicCipherInstance;
