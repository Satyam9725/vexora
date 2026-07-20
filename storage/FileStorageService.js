/**
 * ==========================================================
 * Vexora Framework - File Storage & Encryption Service
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

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Config from "../core/config.js";
import GlobalResponse from "../http/GlobalResponse.js";
import TokenVault from "../security/TokenVault.js";

class FileStorageService {
    constructor() {
        this.tokenData = null;
        this.root = null;
        this.fileLimit = 5 * 1024 * 1024; // Default 5MB
        this.userId = null;
        this.shouldEncrypt = true; // Default encryption mode
    }

    _formatError(message, code = 400) {
        try {
            return GlobalResponse.error(message, code);
        } catch {
            return { status: false, message, code };
        }
    }

    _formatSuccess(data, message = "Success") {
        try {
            return GlobalResponse.success(data, message);
        } catch {
            return { status: true, message, data };
        }
    }

    /**
     * Helper to create a signed upload authorization token with custom root & options
     */
    createToken(options = {}) {
        const root = options.root || "temporary";
        const allowedRootsConfig = Config.get("UPLOAD_ALLOWED_ROOTS") || "public,MyDrive,User,temporary";
        const allowedRootsList = allowedRootsConfig.split(",").map(r => r.trim()).filter(Boolean);
        const baseRoot = root.split("/")[0];

        if (!allowedRootsList.includes(baseRoot)) {
            throw new Error(`Invalid storage root: "${baseRoot}". Allowed roots: ${allowedRootsConfig}`);
        }

        const payload = {
            root: root,
            user_id: options.userId || options.user_id || null,
            file_size: options.fileSize || options.file_size || (Config.number("UPLOAD_MAX_SIZE_MB", 5) * 1024 * 1024),
            encrypt: options.encrypt !== undefined ? Boolean(options.encrypt) : true
        };

        const bindDevice = options.bindDevice !== undefined ? Boolean(options.bindDevice) : true;
        const bindIp = options.bindIp !== undefined ? Boolean(options.bindIp) : false;
        const bindSession = options.bindSession !== undefined ? Boolean(options.bindSession) : false;
        const maxUses = options.maxUses !== undefined ? parseInt(options.maxUses, 10) : 1;

        const ttl = options.ttl || "1H";
        const sealed = TokenVault.seal(payload, "file_manager", ttl, "auth", 0, bindSession, bindIp, bindDevice, maxUses);
        if (!sealed.status) {
            throw new Error(`Token generation failed: ${sealed.error}`);
        }

        return {
            status: true,
            token: sealed.token,
            root: root,
            encrypt: payload.encrypt,
            exp: sealed.exp
        };
    }

    /**
     * Main Entry point for processing file uploads & storage
     */
    async handle(req, fileInput, customToken = null) {
        // 1. Verify token & permissions (sets root, limits, and encryption mode from token)
        const tokenResult = this.verifyToken(req, customToken);
        if (!tokenResult.valid) {
            return this._formatError(tokenResult.message || "Upload session is invalid or expired", 401);
        }

        // Encryption mode is driven directly from signed token configuration
        const isEncryptMode = this.shouldEncrypt;

        // 2. Validate uploaded file
        const fileValidation = this.validateFile(fileInput);
        if (!fileValidation.valid) {
            return this._formatError(fileValidation.message, fileValidation.statusCode || 400);
        }

        const file = fileValidation.file;

        // 3. Process Upload (Option A: Encrypted vs Option B: Normal)
        if (isEncryptMode) {
            // Option A: Encrypted Upload (AES-256-CBC)
            const cryptoResult = this.encrypt(file.buffer);
            const storedFileName = this.store(cryptoResult.data, file.name, true);

            return this._formatSuccess({
                is_encrypted: true,
                original_name: file.originalName,
                encrypted_name: storedFileName,
                file_name: storedFileName,
                user_key_part: cryptoResult.dbKeyPart,
                file_type: file.mime,
                file_size: file.size,
                storage_root: this.root
            }, "Encrypted file uploaded successfully");
        } else {
            // Option B: Normal (Unencrypted) Upload
            const storedFileName = this.store(file.buffer, file.name, false);

            return this._formatSuccess({
                is_encrypted: false,
                original_name: file.originalName,
                file_name: storedFileName,
                file_type: file.mime,
                file_size: file.size,
                storage_root: this.root
            }, "File uploaded successfully");
        }
    }

    /**
     * Verifies authorization token & storage root permissions
     */
    verifyToken(req, customToken = null) {
        let token = customToken;

        if (!token && req) {
            token = (req.body && req.body.file_manager_token) ||
                    (req.query && req.query.file_manager_token) ||
                    (req.headers && (req.headers['file_manager_token'] || req.headers['x-file-manager-token'])) ||
                    null;
        }

        if (!token) {
            return { valid: false, message: "Upload authorization token is required" };
        }

        let tokenData, root, fileSize, encryptSetting;

        // Try TokenVault unseal
        const unseal = TokenVault.unseal(String(token).trim(), "file_manager", "auth");
        if (unseal && unseal.status) {
            tokenData = unseal.data || unseal.payload || {};
            root = tokenData.root || "temporary";
            fileSize = tokenData.file_size || (Config.number("UPLOAD_MAX_SIZE_MB", 5) * 1024 * 1024);
            encryptSetting = tokenData.encrypt !== undefined ? Boolean(tokenData.encrypt) : true;
        } else {
            // Fallback for custom encoded file_manager_token payload
            try {
                const parsed = typeof token === "object" ? token : JSON.parse(Buffer.from(String(token).trim(), "base64").toString("utf8"));
                tokenData = parsed.data || parsed;
                root = parsed.root || tokenData.root || "temporary";
                fileSize = parsed.file_size || (Config.number("UPLOAD_MAX_SIZE_MB", 5) * 1024 * 1024);
                encryptSetting = parsed.encrypt !== undefined ? Boolean(parsed.encrypt) : true;
            } catch {
                return { valid: false, message: "Upload session is invalid or expired" };
            }
        }

        this.tokenData = tokenData;
        this.root = String(root || "temporary").trim();
        this.fileLimit = parseInt(fileSize, 10) || (Config.number("UPLOAD_MAX_SIZE_MB", 5) * 1024 * 1024);
        this.shouldEncrypt = encryptSetting;

        return this.validateRootAndUser();
    }

    /**
     * Validates storage location root strictly against config UPLOAD_ALLOWED_ROOTS
     */
    validateRootAndUser() {
        const allowedRootsConfig = Config.get("UPLOAD_ALLOWED_ROOTS") || "files,storage,public,MyDrive,User,temporary";
        const allowedRootsList = allowedRootsConfig.split(",").map(r => r.trim()).filter(Boolean);
        const baseStorageDir = Config.get("UPLOAD_STORAGE_ROOT") || "files";
        const rootPath = path.isAbsolute(baseStorageDir) ? baseStorageDir : path.join(process.cwd(), baseStorageDir);

        const isAbsoluteInput = path.isAbsolute(this.root);
        const normalizedInput = isAbsoluteInput ? path.normalize(this.root) : path.normalize(this.root).replace(/^(\.\.[\/\\])+/, "").replace(/\\/g, "/");
        const baseRoot = normalizedInput.split("/")[0];

        const isAllowed = allowedRootsList.some(allowed => {
            const normAllowed = path.normalize(allowed);
            return baseRoot === allowed || normalizedInput === allowed || normalizedInput.startsWith(allowed + "/") || normalizedInput.startsWith(normAllowed);
        }) || (isAbsoluteInput && normalizedInput.startsWith(path.normalize(rootPath)));

        if (!isAllowed) {
            return { valid: false, message: `Access to storage location "${this.root}" is not allowed` };
        }

        this.root = normalizedInput;
        this.userId = (this.tokenData && (this.tokenData.user_id || this.tokenData.userId)) || null;

        return { valid: true };
    }

    /**
     * Validates file size, presence, and MIME type
     */
    validateFile(fileInput) {
        if (!fileInput || (!fileInput.buffer && !fileInput.path && !fileInput.tmp_path)) {
            return { valid: false, message: "No file was uploaded", statusCode: 400 };
        }

        let buffer;
        if (fileInput.buffer && Buffer.isBuffer(fileInput.buffer)) {
            buffer = fileInput.buffer;
        } else if (fileInput.path || fileInput.tmp_path) {
            const filepath = fileInput.path || fileInput.tmp_path;
            if (!fs.existsSync(filepath)) {
                return { valid: false, message: "Uploaded temporary file not found", statusCode: 400 };
            }
            buffer = fs.readFileSync(filepath);
        } else {
            return { valid: false, message: "Invalid file stream payload", statusCode: 400 };
        }

        const size = buffer.length;
        if (size <= 0) {
            return { valid: false, message: "Uploaded file size is invalid", statusCode: 400 };
        }

        if (size > this.fileLimit) {
            const maxMb = (this.fileLimit / (1024 * 1024)).toFixed(1);
            return { valid: false, message: `File size exceeds the ${maxMb}MB upload limit`, statusCode: 413 };
        }

        const originalName = path.basename(fileInput.original_name || fileInput.name || fileInput.filename || "file");
        const safeName = this.safeName(originalName);

        const mime = this.detectMime(buffer, fileInput.mime || fileInput.mimetype || fileInput.type);
        const allowedMimesStr = Config.get("UPLOAD_ALLOWED_MIME_TYPES") || "image/jpeg,image/png,image/jpg,application/pdf";
        const allowedMimesList = allowedMimesStr.split(",").map(m => m.trim().toLowerCase());

        if (!mime || !allowedMimesList.includes(mime.toLowerCase())) {
            return { valid: false, message: "Unsupported file format", statusCode: 415 };
        }

        return {
            valid: true,
            file: {
                buffer,
                size,
                name: safeName,
                originalName,
                mime
            }
        };
    }

    /**
     * Generates a safe filename by replacing special characters with underscores
     */
    safeName(name) {
        const basename = path.basename(name);
        return basename.replace(/[^A-Za-z0-9._-]/g, "_");
    }

    /**
     * Detects MIME type strictly from file buffer magic bytes.
     * Prevents extension spoofing (e.g. renaming .zip or .exe to .png).
     */
    detectMime(buffer, fallbackMime = null) {
        if (!buffer || buffer.length < 4) {
            return false;
        }

        // 1. Strict Magic Numbers Check
        // JPEG / JPG: FF D8 FF
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return "image/jpeg";
        }
        // PNG: 89 50 4E 47
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return "image/png";
        }
        // PDF: 25 50 44 46 (%PDF)
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
            return "application/pdf";
        }

        // 2. Blacklisted Magic Bytes (ZIP, EXE, ELF, RAR) - Instant Rejection!
        // ZIP / JAR / APK: 50 4B 03 04 or 50 4B 05 06
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
            return false; // Spoofed ZIP archive!
        }
        // EXE / DLL: 4D 5A ("MZ")
        if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
            return false; // Spoofed Windows Executable!
        }
        // ELF: 7F 45 4C 46
        if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
            return false; // Spoofed Linux Binary!
        }
        // RAR: 52 61 72 21 ("Rar!")
        if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
            return false; // Spoofed RAR archive!
        }

        return false;
    }

    /**
     * Encrypts file buffer payload using AES-256-CBC
     */
    encrypt(fileBuffer) {
        const dbKeyPart = crypto.randomBytes(16);
        const secretKey = Config.get("AES_SECRET") || Config.get("UPLOAD_SECRET_KEY") || "VexoraSecretMasterKey32BytesLong!";
        
        const fullKey = crypto.createHash("sha256").update(Buffer.concat([dbKeyPart, Buffer.from(secretKey)])).digest();
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv("aes-256-cbc", fullKey, iv);
        const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

        return {
            data: Buffer.concat([iv, encrypted]),
            dbKeyPart: dbKeyPart.toString("base64")
        };
    }

    /**
     * Decrypts encrypted file payload using key part
     */
    decrypt(encryptedDataBuffer, dbKeyPartBase64) {
        const dbKeyPart = Buffer.from(dbKeyPartBase64, "base64");
        const secretKey = Config.get("AES_SECRET") || Config.get("UPLOAD_SECRET_KEY") || "VexoraSecretMasterKey32BytesLong!";

        const fullKey = crypto.createHash("sha256").update(Buffer.concat([dbKeyPart, Buffer.from(secretKey)])).digest();
        const iv = encryptedDataBuffer.subarray(0, 16);
        const encryptedPayload = encryptedDataBuffer.subarray(16);

        const decipher = crypto.createDecipheriv("aes-256-cbc", fullKey, iv);
        return Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
    }

    /**
     * Stores file buffer to disk securely (supports both encrypted .enc and normal files)
     */
    store(dataBuffer, originalSafeName, isEncrypted = true) {
        const ext = path.extname(originalSafeName) || "";
        const fileName = isEncrypted 
            ? crypto.randomBytes(16).toString("hex") + ".enc"
            : crypto.randomBytes(16).toString("hex") + ext;

        const baseStorageDir = Config.get("UPLOAD_STORAGE_ROOT") || "storage";
        const rootPath = path.isAbsolute(baseStorageDir) ? baseStorageDir : path.join(process.cwd(), baseStorageDir);

        const isAbsoluteInput = path.isAbsolute(this.root);
        let targetDir;
        if (isAbsoluteInput) {
            targetDir = this.userId ? path.join(this.root, String(this.userId)) : this.root;
        } else {
            targetDir = this.userId ? path.join(rootPath, this.root, String(this.userId)) : path.join(rootPath, this.root);
        }

        // Enforce directory traversal safety check for relative inputs
        if (!isAbsoluteInput) {
            const relative = path.relative(rootPath, targetDir);
            if (relative.startsWith("..")) {
                throw new Error(`Storage root violation: Path "${this.root}" escapes allowed storage root.`);
            }
        }

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const fullFilePath = path.join(targetDir, fileName);
        fs.writeFileSync(fullFilePath, dataBuffer);

        return fileName;
    }
}

export default new FileStorageService();
export { FileStorageService };
