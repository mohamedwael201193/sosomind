/**
 * Symmetric AES-256-GCM encryption for embedded wallet private keys.
 * Server-side only — never exposed to clients.
 *
 * Storage format: iv(32 hex) + authTag(32 hex) + ciphertext(hex)
 * Total length: 64 + 64 + (key length * 2) characters
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPT_KEY || '';
  if (!raw) {
    // Generate a deterministic fallback from the bot token — NOT for production
    const token = process.env.TELEGRAM_BOT_TOKEN || 'sosomind-default-key';
    return crypto.createHash('sha256').update(token).digest();
  }
  // Accept either a 64-char hex string (32 bytes) or any passphrase (hashed to 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptPrivateKey(privateKey: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // iv(32) + tag(32) + ciphertext(variable)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

export function decryptPrivateKey(encrypted: string): string {
  const key = getKey();
  const iv = Buffer.from(encrypted.slice(0, 32), 'hex');
  const tag = Buffer.from(encrypted.slice(32, 64), 'hex');
  const ciphertext = Buffer.from(encrypted.slice(64), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
