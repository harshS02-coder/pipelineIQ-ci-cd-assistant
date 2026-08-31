import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * ============================================================================
 * ENCRYPTION UTILITY — AES-256-GCM
 * ============================================================================
 *
 * WHY WE ENCRYPT:
 * GitHub OAuth access tokens are sensitive credentials. If an attacker gains
 * access to our database (SQL injection, backup leak, etc.), they'd have
 * full access to every user's GitHub repos. Encrypting tokens at rest means
 * even a database breach doesn't expose the tokens — the attacker also needs
 * the ENCRYPTION_KEY from our environment.
 *
 * WHY AES-256-GCM (and not AES-CBC or other modes):
 * - AES-256: 256-bit key = 2^256 possible keys. Quantum-resistant enough.
 * - GCM (Galois/Counter Mode): Provides both CONFIDENTIALITY and INTEGRITY.
 *   - Confidentiality: The data is encrypted (unreadable without the key).
 *   - Integrity: GCM produces an "authentication tag" that detects if the
 *     ciphertext was tampered with. AES-CBC doesn't do this — an attacker
 *     could flip bits in the ciphertext and corrupt the decrypted data
 *     without detection (the "padding oracle" attack).
 *
 * KEY CONCEPTS:
 * 1. ENCRYPTION_KEY: A 32-byte (256-bit) secret key stored in .env
 *    We store it as a 64-character hex string. Never commit this to git.
 *
 * 2. IV (Initialization Vector): A random 12-byte (96-bit) value generated
 *    FRESH for every encryption operation. The IV ensures that encrypting
 *    the same plaintext twice produces different ciphertext. It is NOT
 *    secret — we store it alongside the ciphertext. But it MUST be unique
 *    per encryption (hence we use crypto.randomBytes, not a counter).
 *
 * 3. Auth Tag: A 16-byte value produced by GCM mode that acts like a
 *    "checksum" over the ciphertext. If anyone modifies even 1 bit of
 *    the ciphertext, the auth tag won't match during decryption, and
 *    Node.js will throw an error. This prevents tampering.
 *
 * STORAGE FORMAT:
 * We store three values in the database for each encrypted token:
 *   - accessToken:    hex-encoded ciphertext
 *   - accessTokenIv:  hex-encoded IV (12 bytes = 24 hex chars)
 *   - accessTokenTag: hex-encoded auth tag (16 bytes = 32 hex chars)
 * ============================================================================
 */

// AES-256-GCM requires exactly 32 bytes (256 bits) for the key
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM standard: 96-bit IV is recommended by NIST
const TAG_LENGTH = 16; // GCM produces a 128-bit (16-byte) auth tag

/**
 * Get the encryption key from environment variables.
 * The key must be a 64-character hex string (32 bytes when decoded).
 *
 * @returns {Buffer} The 32-byte encryption key
 * @throws {Error} If ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${keyHex.length} characters.`
    );
  }

  // Convert hex string to a Buffer of raw bytes
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * STEP-BY-STEP:
 * 1. Generate a random 12-byte IV (ensures uniqueness per encryption)
 * 2. Create an AES-256-GCM cipher with our key + the IV
 * 3. Feed the plaintext through the cipher → produces ciphertext
 * 4. Finalize the cipher → produces the auth tag
 * 5. Return all three pieces: ciphertext, IV, and auth tag
 *
 * @param {string} plaintext - The text to encrypt (e.g., a GitHub access token)
 * @returns {{ encrypted: string, iv: string, tag: string }} Hex-encoded values
 */
export function encrypt(plaintext) {
  // Step 1: Generate a fresh random IV for this encryption
  // CRITICAL: Never reuse an IV with the same key in GCM mode.
  // Reusing IV+key completely breaks GCM's security guarantees.
  const iv = crypto.randomBytes(IV_LENGTH);

  // Step 2: Create the cipher
  // createCipheriv = "create cipher with initialization vector"
  // Arguments: algorithm, key, iv
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Step 3: Encrypt the plaintext
  // update() processes the data, final() finalizes the encryption
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Step 4: Get the authentication tag
  // This tag is generated AFTER final() is called
  const tag = cipher.getAuthTag();

  // Step 5: Return all three components
  // All are stored in the database as hex strings
  return {
    encrypted,         // The ciphertext (hex-encoded)
    iv: iv.toString('hex'),    // The IV (hex-encoded, 24 chars)
    tag: tag.toString('hex'),  // The auth tag (hex-encoded, 32 chars)
  };
}

/**
 * Decrypt a ciphertext string using AES-256-GCM.
 *
 * STEP-BY-STEP:
 * 1. Convert hex strings back to Buffers
 * 2. Create an AES-256-GCM decipher with the same key + original IV
 * 3. Set the auth tag (so GCM can verify integrity)
 * 4. Feed the ciphertext through the decipher → produces plaintext
 * 5. Finalize — if the auth tag doesn't match, this THROWS an error
 *    (meaning the ciphertext was tampered with)
 *
 * @param {string} encryptedHex - Hex-encoded ciphertext
 * @param {string} ivHex - Hex-encoded IV (from the encrypt() call)
 * @param {string} tagHex - Hex-encoded auth tag (from the encrypt() call)
 * @returns {string} The original plaintext
 * @throws {Error} If decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(encryptedHex, ivHex, tagHex) {
  // Step 1: Convert hex strings back to raw byte Buffers
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = getEncryptionKey();

  // Step 2: Create the decipher with the same algorithm, key, and IV
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  // Step 3: Set the expected auth tag BEFORE processing data
  // GCM will compare this against the tag it computes during decryption
  decipher.setAuthTag(tag);

  // Step 4: Decrypt the ciphertext
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');

  // Step 5: Finalize — this is where GCM verifies the auth tag
  // If the ciphertext was tampered with, final() throws:
  //   "Error: Unsupported state or unable to authenticate data"
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a random hex string suitable for webhook secrets.
 * Each webhook gets its own secret for HMAC signature verification.
 *
 * @param {number} bytes - Number of random bytes (default: 32 = 256-bit)
 * @returns {string} Hex-encoded random string
 */
export function generateWebhookSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export default { encrypt, decrypt, generateWebhookSecret };
