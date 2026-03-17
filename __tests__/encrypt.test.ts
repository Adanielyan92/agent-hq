import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/encrypt';

describe('encrypt/decrypt', () => {
  it('round-trips a token', () => {
    const token = 'gho_test_token_12345';
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const token = 'same_token';
    expect(encrypt(token)).not.toBe(encrypt(token));
  });

  it('stored format is IV:ciphertext:authTag (3 hex segments)', () => {
    const stored = encrypt('token');
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});
