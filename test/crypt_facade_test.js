import assert from "node:assert";
import Vexora from "../Vexora.js";

function testCryptFacadeAdvanced() {
  console.log("==========================================");
  console.log("🔒 ADVANCED VEXORA.CRYPT FACADE INTEGRATION TEST");
  console.log("==========================================\n");

  const originalPayload = {
    user_id: 999,
    email: "admin@vexora.io",
    role: "super_admin",
    secret_key: "AES_POLYMORPHIC_SECRET"
  };

  // 1. Matrix Metadata (Sanitized)
  const matrixInfo = Vexora.Crypt.getMatrixInfo();
  console.log("1️⃣ Installation Matrix Metadata (Strictly Sanitized):");
  console.log("   • Matrix ID            :", matrixInfo.matrix_id);
  console.log("   • Status               :", matrixInfo.status);
  console.log("   • Algorithm            :", matrixInfo.algorithm);
  console.log("   • Custom Key Bound     :", matrixInfo.is_custom_key_bound);
  assert.strictEqual(matrixInfo.status, "active_secured");
  assert.strictEqual(matrixInfo.is_custom_key_bound, true);
  assert.strictEqual(matrixInfo.custom_key_prefix, undefined, "custom_key_prefix must NOT be exposed");
  console.log("   ✅ Vexora.Crypt.getMatrixInfo() passed zero-leak security check!\n");

  // 2. Encrypt Payload
  console.log("2️⃣ Encrypting via Vexora.Crypt.encrypt()...");
  const cipherText = Vexora.Crypt.encrypt(originalPayload, "MasterPassword2026");
  console.log("   Ciphertext:", cipherText);
  assert.ok(cipherText);
  console.log("   ✅ Encryption passed!\n");

  // 3. Decrypt Payload
  console.log("3️⃣ Decrypting via Vexora.Crypt.decrypt()...");
  const decryptedPayload = Vexora.Crypt.decrypt(cipherText, "MasterPassword2026");
  console.log("   Decrypted Payload:", decryptedPayload);

  assert.strictEqual(decryptedPayload.user_id, 999);
  assert.strictEqual(decryptedPayload.email, "admin@vexora.io");
  assert.strictEqual(decryptedPayload.role, "super_admin");
  console.log("   ✅ Decryption passed 100%!\n");

  // 4. Test HMAC Integrity Protection against Tampering
  console.log("4️⃣ Testing HMAC-SHA512 tampering protection...");
  const tamperedCipher = cipherText.slice(0, -4) + "XXXX";
  let tamperCaught = false;
  try {
    Vexora.Crypt.decrypt(tamperedCipher, "MasterPassword2026");
  } catch (err) {
    tamperCaught = true;
    console.log("   Caught Tampered Cipher Error:", err.message);
  }
  assert.strictEqual(tamperCaught, true, "Tampered ciphertext should be rejected instantly");
  console.log("   ✅ HMAC-SHA512 signature validation prevented tampering!\n");

  // 5. Test Dynamic Custom Key Update
  console.log("5️⃣ Testing Vexora.Crypt.setCustomKey()...");
  Vexora.Crypt.setCustomKey("new_custom_ultra_secure_key_2026");

  const newCipher = Vexora.Crypt.encrypt("Custom Key Test", "secret123");
  const newDecrypted = Vexora.Crypt.decrypt(newCipher, "secret123");
  assert.strictEqual(newDecrypted, "Custom Key Test");
  console.log("   ✅ Dynamic custom_key update passed!\n");

  console.log("==========================================");
  console.log("🎉 ADVANCED VEXORA.CRYPT FACADE TEST PASSED 100%!");
  console.log("==========================================\n");
}

testCryptFacadeAdvanced();
