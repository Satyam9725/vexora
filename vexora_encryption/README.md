# 🔒 Vexora Encryption Engine

An enterprise-grade, zero-dependency **Dynamic Polymorphic Encryption Suite** built for Node.js.

## 🚀 Key Features

1. **Installation-Unique Polymorphic Matrix**: Each project installation auto-generates a unique cryptographic matrix (dynamic S-Boxes, bit-shifts, and master pepper keys).
2. **Multi-Layer Security Architecture**:
   - **Layer 1**: Dynamic PBKDF2-SHA512 Key Derivation (100,000–200,000 rounds)
   - **Layer 2**: Industry-Standard AES-256-GCM (Authenticated Data Encryption)
   - **Layer 3**: Installation-Unique S-Box Substitution Permutation
   - **Layer 4**: Dynamic Bitwise Rotation & Secret Pepper XOR
3. **100% PHP-Compatible Bcrypt Hashing**: Generates and verifies standard `$2y$` / `$2b$` password hashes identical to PHP's `password_hash()` and `password_verify()`.
4. **Server & Client IP Inspection**: Utility helpers to resolve local network server IP and proxy-aware client IP addresses.

---

## 🛠️ Usage Example

```javascript
import { VexoraEncryption } from "./vexora_encryption/index.js";

// 1. Polymorphic Data Encryption
const cipherText = VexoraEncryption.encrypt("Sensitive Database Payload", "SecretKey123");
console.log("Ciphertext:", cipherText);

// 2. Polymorphic Data Decryption
const plainText = VexoraEncryption.decrypt(cipherText, "SecretKey123");
console.log("Plaintext:", plainText);

// 3. PHP-Compatible $2y$ Password Hashing
const passHash = VexoraEncryption.password_hash("myPassword", 10);
const isValid = VexoraEncryption.password_verify("myPassword", passHash);

// 4. Server IP Lookup
const serverIp = VexoraEncryption.getServerIp();
```
