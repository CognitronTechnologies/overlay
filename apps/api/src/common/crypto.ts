import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Authenticated principal attached to requests by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  role: 'user' | 'tipster' | 'admin';
  /** Present when role === 'tipster'. */
  tipsterId?: string;
}

/** Hash a password with scrypt: returns `salt:hash` (both hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Verify a password against a stored `salt:hash`. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return (
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

// Convenience HMAC helper (used elsewhere for webhook signature checks).
export function hmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
