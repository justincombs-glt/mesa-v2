// ============================================================================
// Token encryption for device OAuth credentials
//
// Phase 9a: stores OAuth access/refresh tokens encrypted at rest. Uses
// AES-256-GCM with a server-side key. The encrypted format is base64(IV[12B]
// || ciphertext || authTag[16B]) — a single self-contained string that's
// safe to store in a TEXT column.
//
// The key comes from env var DEVICE_TOKEN_ENCRYPTION_KEY which must be a
// base64-encoded 32-byte (256-bit) random key. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// If the key is missing or malformed, encrypt() throws. Decrypt() also throws
// on tampering (GCM auth tag mismatch). Both throw clearly so callers can
// handle gracefully — typically by marking the connection 'reconnect_needed'.
// ============================================================================

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function _loadKey(): Buffer {
  const b64 = process.env.DEVICE_TOKEN_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      'DEVICE_TOKEN_ENCRYPTION_KEY env var is not set. Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `DEVICE_TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}).`,
    );
  }
  return key;
}

/**
 * Encrypt a plaintext token. Returns a single base64 string that's safe to
 * store in a TEXT column. Includes the IV + ciphertext + auth tag.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return '';
  const key = _loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

/**
 * Decrypt a previously-encrypted token. Throws on auth-tag mismatch or
 * malformed input.
 */
export function decryptToken(encoded: string): string {
  if (!encoded) return '';
  const key = _loadKey();
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < IV_BYTES + 16) {
    throw new Error('Encrypted token payload is too short to be valid.');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - 16);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
