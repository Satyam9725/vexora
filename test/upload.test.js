import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import Vexora from "../Vexora.js";

export async function run() {
    console.log("👉 Running File Storage & Encryption Service Tests...");

    // Test 1: Helper Token Generation with Custom Root ("User/my_docs")
    const tokenObj = Vexora.Storage.createToken({
        root: "User/my_docs",
        userId: "user_1001",
        fileSize: 5 * 1024 * 1024,
        encrypt: true,
        ttl: "1H"
    });

    assert.strictEqual(tokenObj.status, true, "createToken should succeed");
    assert.ok(tokenObj.token, "token string should be generated");
    assert.strictEqual(tokenObj.root, "User/my_docs");

    // Test 2: Option A - Encrypted File Upload (is_encrypted: true)
    const samplePdfBuffer = Buffer.from("%PDF-1.4 sample pdf file content for encrypted storage testing %EOF");
    const encryptedFileInput = {
        buffer: samplePdfBuffer,
        original_name: "secure_contract.pdf",
        mime: "application/pdf"
    };

    const reqEncrypted = {
        body: { file_manager_token: tokenObj.token },
        query: {},
        headers: {}
    };

    const encResponse = await Vexora.Storage.handle(reqEncrypted, encryptedFileInput);
    assert.strictEqual(encResponse.status, true, "Encrypted upload response status should be true");
    assert.strictEqual(encResponse.data.is_encrypted, true, "is_encrypted should be true");
    assert.ok(encResponse.data.encrypted_name.endsWith(".enc"), "Encrypted filename should end with .enc");
    assert.ok(encResponse.data.user_key_part, "Encrypted upload should include user_key_part");

    // Decrypt & verify file content
    const storageRoot = Vexora.core ? Vexora.core.config.get("UPLOAD_STORAGE_ROOT") || "files" : "files";
    const encFilePath = path.join(process.cwd(), storageRoot, "User/my_docs", "user_1001", encResponse.data.encrypted_name);
    assert.ok(fs.existsSync(encFilePath), "Encrypted file should exist on disk");

    const encDiskData = fs.readFileSync(encFilePath);
    const decryptedData = Vexora.Storage.decrypt(encDiskData, encResponse.data.user_key_part);
    assert.strictEqual(decryptedData.toString("utf8"), samplePdfBuffer.toString("utf8"), "Decrypted buffer should match original PDF payload");

    // Cleanup encrypted file
    try { fs.unlinkSync(encFilePath); } catch {}

    // Test 3: Option B - Normal File Upload (is_encrypted: false)
    const normalTokenObj = Vexora.Storage.createToken({
        root: "public/avatar",
        encrypt: false,
        ttl: "1H"
    });

    const sampleJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const normalFileInput = {
        buffer: sampleJpgBuffer,
        original_name: "profile_pic.jpg",
        mime: "image/jpeg"
    };

    const reqNormal = {
        body: { file_manager_token: normalTokenObj.token },
        query: {},
        headers: {}
    };

    const normalResponse = await Vexora.Storage.handle(reqNormal, normalFileInput);
    assert.strictEqual(normalResponse.status, true, "Normal upload response status should be true");
    assert.strictEqual(normalResponse.data.is_encrypted, false, "is_encrypted should be false");
    assert.ok(normalResponse.data.file_name.endsWith(".jpg"), "Normal file should preserve file extension");

    // Verify raw unencrypted file on disk
    const normalFilePath = path.join(process.cwd(), storageRoot, "public/avatar", normalResponse.data.file_name);
    assert.ok(fs.existsSync(normalFilePath), "Normal unencrypted file should exist on disk");
    
    const normalDiskData = fs.readFileSync(normalFilePath);
    assert.strictEqual(normalDiskData.toString("hex"), sampleJpgBuffer.toString("hex"), "Normal file content on disk should match original raw JPG buffer");

    // Cleanup normal file
    try { fs.unlinkSync(normalFilePath); } catch {}

    // Test 4: Root Security Enforcement against UPLOAD_ALLOWED_ROOTS
    assert.throws(() => {
        Vexora.Storage.createToken({ root: "unauthorized_folder/hack" });
    }, /Invalid storage root/, "createToken should throw an error for unauthorized storage roots");

    // Test 5: Extension Spoofing Guard (.zip renamed to .png)
    const spoofedTokenObj = Vexora.Storage.createToken({
        root: "public/avatar",
        encrypt: false,
        ttl: "1H"
    });
    const reqSpoofed = {
        body: { file_manager_token: spoofedTokenObj.token },
        query: {},
        headers: {}
    };

    const spoofedZipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]); // ZIP PK Magic Bytes
    const spoofedFileInput = {
        buffer: spoofedZipBuffer,
        original_name: "hacked_photo.png", // Renamed ZIP archive!
        mime: "image/png"
    };

    const spoofedResponse = await Vexora.Storage.handle(reqSpoofed, spoofedFileInput);
    assert.strictEqual(spoofedResponse.status, false, "Spoofed .zip file renamed to .png should be rejected");
    assert.strictEqual(spoofedResponse.message, "Unsupported file format", "Should reject spoofed ZIP file as unsupported format");

    console.log("✅ File Storage & Encryption Service Tests Passed.\n");
}
