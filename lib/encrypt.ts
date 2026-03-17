import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_SECRET ?? '', 'base64');
  if (key.length !== 32) {
    throw new Error(`TOKEN_ENCRYPTION_SECRET must decode to exactly 32 bytes, got ${key.length}. Run: openssl rand -base64 32`);
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: ivHex:ciphertextHex:authTagHex
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

export function decrypt(stored: string): string {
  try {
    const [ivHex, ciphertextHex, authTagHex] = stored.split(':');
    if (!ivHex || !ciphertextHex || !authTagHex) {
      throw new Error('Invalid encrypted format: expected ivHex:ciphertextHex:authTagHex');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (err) {
    throw new Error(`Failed to decrypt token: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}
