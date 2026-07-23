import assert from "node:assert";
import Vexora from "../Vexora.js";

function testBcryptPasswordHashing() {
  console.log("==========================================");
  console.log("🔒 VEXORA PHP-COMPATIBLE BCRYPT $2y$ HASHING TEST");
  console.log("==========================================\n");

  const plainPassword = "rasmuslerdorf";

  // 1. Generate $2y$ Bcrypt Hash (PHP password_hash equivalent)
  console.log("1️⃣ Generating $2y$ Bcrypt password hash...");
  const hash = Vexora.password_hash(plainPassword, 10);
  console.log("   Generated Hash:", hash);

  assert.ok(hash.startsWith("$2y$10$"), "Hash should start with $2y$10$");
  assert.strictEqual(hash.length, 60, "Bcrypt hash should be exactly 60 characters long");
  console.log("   ✅ Hash format matches PHP password_hash() $2y$ standard!\n");

  // 2. Verify Generated Hash (PHP password_verify equivalent)
  console.log("2️⃣ Verifying generated $2y$ hash...");
  const isMatch = Vexora.password_verify(plainPassword, hash);
  assert.strictEqual(isMatch, true, "Correct password should verify successfully");
  console.log("   ✅ password_verify() passed for correct password!\n");

  // 3. Verify Wrong Password
  console.log("3️⃣ Testing wrong password verification...");
  const isWrong = Vexora.password_verify("wrong_password", hash);
  assert.strictEqual(isWrong, false, "Wrong password should return false");
  console.log("   ✅ password_verify() correctly rejected wrong password!\n");

  // 4. Test Vexora.Hash.make() and Vexora.Hash.verify()
  console.log("4️⃣ Testing Vexora.Hash.make() and Vexora.Hash.verify()...");
  const hash2 = Vexora.Hash.make("secret123");
  assert.ok(hash2.startsWith("$2y$10$"));
  assert.strictEqual(Vexora.Hash.verify("secret123", hash2), true);
  assert.strictEqual(Vexora.Hash.check("secret123", hash2), true);
  assert.strictEqual(Vexora.Hash.check("wrong_secret", hash2), false);
  console.log("   ✅ Vexora.Hash facade methods passed!\n");

  console.log("==========================================");
  console.log("🎉 ALL PHP-COMPATIBLE BCRYPT TESTS PASSED 100%!");
  console.log("==========================================\n");
}

testBcryptPasswordHashing();
