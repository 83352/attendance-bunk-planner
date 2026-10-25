import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSession, encryptSession } from './session';

const key = createHash('sha256').update('test-secret').digest();
const session = { cookie: 'sid=abc123', bearer: 'token-xyz' };

describe('stored sign-in encryption', () => {
  it('round-trips a session', () => {
    expect(decryptSession(encryptSession(session, key), key)).toEqual(session);
    expect(decryptSession(encryptSession({ cookie: '', bearer: null }, key), key)).toEqual({ cookie: '', bearer: null });
  });

  it('does not leave the token readable in the cookie value', () => {
    const value = encryptSession(session, key);
    expect(value).not.toContain('token-xyz');
    expect(Buffer.from(value, 'base64url').toString('utf8')).not.toContain('token-xyz');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSession(session, key)).not.toBe(encryptSession(session, key));
  });

  it('rejects the wrong key, tampering, truncation and the old unencrypted format', () => {
    const value = encryptSession(session, key);
    const otherKey = createHash('sha256').update('other').digest();
    expect(decryptSession(value, otherKey)).toBeNull();
    const bytes = Buffer.from(value, 'base64url');
    bytes[bytes.length - 1] ^= 1;
    expect(decryptSession(bytes.toString('base64url'), key)).toBeNull();
    expect(decryptSession(value.slice(0, 20), key)).toBeNull();
    expect(decryptSession(Buffer.from(JSON.stringify(session)).toString('base64url'), key)).toBeNull();
    expect(decryptSession('', key)).toBeNull();
  });
});
