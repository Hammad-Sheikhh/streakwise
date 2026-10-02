import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// AUTH-2: the login session is a signed cookie, `<expiry ms>.<signature>`. Nothing is stored on the
// server. The signature also covers a digest of the passcode, so changing APP_PASSCODE (or
// SESSION_SECRET) logs out every device.

export const SESSION_COOKIE = 'sw_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface SessionKeys {
  sessionSecret: string;
  passcode: string;
}

function hmac(key: string, message: string): Buffer {
  return createHmac('sha256', key).update(message).digest();
}

function sign(keys: SessionKeys, expiresAt: number): string {
  const passcodeDigest = createHash('sha256').update(keys.passcode).digest('base64url');
  return hmac(keys.sessionSecret, `session.v1.${expiresAt}.${passcodeDigest}`).toString(
    'base64url',
  );
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionToken(keys: SessionKeys, now: Date): string {
  const expiresAt = now.getTime() + SESSION_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${sign(keys, expiresAt)}`;
}

export function isValidSessionToken(token: string, keys: SessionKeys, now: Date): boolean {
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match?.[1] || !match[2]) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= now.getTime()) return false;
  return safeEqual(Buffer.from(match[2]), Buffer.from(sign(keys, expiresAt)));
}

/** Constant-time passcode check: both sides are hashed to equal-length digests first. */
export function passcodeMatches(input: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return safeEqual(digest(input), digest(expected));
}

/** AUTH-5: IPs are stored only as salted (keyed) hashes. */
export function hashIp(ip: string, sessionSecret: string): string {
  return hmac(sessionSecret, `ip.v1.${ip}`).toString('hex');
}

const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Strict';

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE_SECONDS}; ${COOKIE_ATTRIBUTES}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}
