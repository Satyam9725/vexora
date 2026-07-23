import assert from "node:assert";
import VexoraEncryption from "./index.js";

function runVexoraEncryptionTest() {
  console.log("==========================================");
  console.log("🔒 VEXORA DYNAMIC POLYMORPHIC ENCRYPTION TEST");
  console.log("==========================================\n");

  // 1. Matrix Metadata Info (Sanitized)
  const info = VexoraEncryption.getMatrixInfo();
  console.log("1️⃣ Installation Matrix Metadata (Zero-Leak Sanitized):");
  console.log("   • Matrix ID            :", info.matrix_id);
  console.log("   • Status               :", info.status);
  console.log("   • Algorithm            :", info.algorithm);
  console.log("   • Custom Key Bound     :", info.is_custom_key_bound);
  assert.strictEqual(info.status, "active_secured");
  assert.strictEqual(info.is_custom_key_bound, true);
  console.log("   ✅ Installation-unique matrix loaded securely!\n");

  // 2. Encrypt & Decrypt String Data
  const plainText = "Vexora Super Secret Encryption Payload 2026!";
  console.log("2️⃣ Encrypting String Data...");
  const cipherText = VexoraEncryption.encrypt(plainText, "mySecretPassword123");
  console.log("   Encrypted Ciphertext:", cipherText);

  assert.notStrictEqual(plainText, cipherText);
  assert.ok(cipherText.length > 20);

  console.log("\n3️⃣ Decrypting Ciphertext...");
  const decryptedText = VexoraEncryption.decrypt(cipherText, "mySecretPassword123");
  console.log("   Decrypted Text:", decryptedText);
  assert.strictEqual(plainText, decryptedText);
  console.log("   ✅ String Encryption & Decryption passed 100%!\n");

  // 4. Encrypt & Decrypt JSON Object Data
  const jsonObject = { user_id: 101, username: "Satyam", role: "admin", is_authenticated: true };
  console.log("4️⃣ Encrypting JSON Object Data...");
  const jsonCipherText = VexoraEncryption.encrypt(jsonObject);
  const decryptedObject = VexoraEncryption.decrypt(jsonCipherText);

  assert.strictEqual(decryptedObject.user_id, 101);
  assert.strictEqual(decryptedObject.username, "Satyam");
  console.log("   Decrypted Object:", decryptedObject);
  console.log("   ✅ JSON Object Encryption & Decryption passed 100%!\n");

  // 5. Server IP Address Lookup
  console.log("5️⃣ Server Network IP Address:");
  const serverIp = VexoraEncryption.getServerIp();
  console.log("   Server IP:", serverIp);
  assert.ok(serverIp);
  console.log("   ✅ Server IP Lookup passed!\n");

  // 6. PHP-Compatible $2y$ Bcrypt Hashing
  console.log("6️⃣ Testing PHP-Compatible $2y$ Bcrypt Hashing...");
  const passHash = VexoraEncryption.password_hash("mySecurePassword", 10);
  console.log("   Generated Hash:", passHash);
  assert.ok(passHash.startsWith("$2y$10$"));

  const isPasswordValid = VexoraEncryption.password_verify("mySecurePassword", passHash);
  assert.strictEqual(isPasswordValid, true);
  console.log("   ✅ PHP-Compatible Password Hashing & Verification passed 100%!\n");

  console.log("==========================================");
  console.log("🎉 ALL VEXORA ENCRYPTION ENGINE TESTS PASSED SUCCESFULLY!");
  console.log("==========================================\n");
}

runVexoraEncryptionTest();
