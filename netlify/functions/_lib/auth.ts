import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Signed cookies (ACCT-3, ACCT-7). Supabase Auth checks the password once, at login; after that a
// cookie signed with SESSION_SECRET says who the user is, so most requests need no call to
// Supabase Auth. Nothing is stored on the server except `sessions_valid_after` (see api.ts).
//
// Token shape: `<field>.<field>....<expiry ms>.<signature>`. The purpose is part of the signed
// message, so a claim token can't be used as a login session and the other way round.

export const SESSION_COOKIE = 'sw_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** ACCT-7: proof that the old passcode was entered; lasts long enough to confirm an email. */
export const CLAIM_COOKIE = 'sw_claim';
export const CLAIM_MAX_AGE_SECONDS = 24 * 60 * 60;

/** ACCT-4: lets a reset-link visitor choose a new password without the old one. */
export const RECOVERY_COOKIE = 'sw_recovery';
export const RECOVERY_MAX_AGE_SECONDS = 30 * 60;

type Purpose = 'session.v2' | 'claim.v1' | 'recovery.v1';

function hmac(key: string, message: string): Buffer {
  return createHmac('sha256', key).update(message).digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(secret: string, purpose: Purpose, fields: readonly string[]): string {
  return hmac(secret, [purpose, ...fields].join('.')).toString('base64url');
}

function createToken(
  secret: string,
  purpose: Purpose,
  fields: readonly string[],
  expiresAt: number,
): string {
  const signed = [...fields, String(expiresAt)];
  return [...signed, sign(secret, purpose, signed)].join('.');
}

/** Returns the token's fields (without expiry and signature) if it is genuine and unexpired. */
function readToken(
  secret: string,
  purpose: Purpose,
  token: string | undefined,
  fieldCount: number,
  now: Date,
): string[] | null {
  const parts = token?.split('.') ?? [];
  if (parts.length !== fieldCount + 2) return null;
  const signature = parts.pop() ?? '';
  const expiresAt = Number(parts.at(-1));
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return null;
  if (!safeEqual(Buffer.from(signature), Buffer.from(sign(secret, purpose, parts)))) return null;
  return parts.slice(0, fieldCount);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionInfo {
  userId: string;
  issuedAt: Date;
}

export function createSessionToken(secret: string, userId: string, now: Date): string {
  const issuedAt = now.getTime();
  return createToken(
    secret,
    'session.v2',
    [userId, String(issuedAt)],
    issuedAt + SESSION_MAX_AGE_SECONDS * 1000,
  );
}

export function readSessionToken(
  secret: string,
  token: string | undefined,
  now: Date,
): SessionInfo | null {
  const fields = readToken(secret, 'session.v2', token, 2, now);
  if (!fields?.[0] || !UUID.test(fields[0])) return null;
  return { userId: fields[0], issuedAt: new Date(Number(fields[1])) };
}

/** The claim proof also covers a digest of the passcode, so changing APP_PASSCODE revokes it. */
function passcodeDigest(passcode: string): string {
  return createHash('sha256').update(passcode).digest('base64url');
}

export function createClaimToken(secret: string, passcode: string, now: Date): string {
  return createToken(
    secret,
    'claim.v1',
    [passcodeDigest(passcode)],
    now.getTime() + CLAIM_MAX_AGE_SECONDS * 1000,
  );
}

export function isValidClaimToken(
  secret: string,
  passcode: string | undefined,
  token: string | undefined,
  now: Date,
): boolean {
  if (!passcode) return false;
  const fields = readToken(secret, 'claim.v1', token, 1, now);
  return fields?.[0] === passcodeDigest(passcode);
}

export function createRecoveryToken(secret: string, userId: string, now: Date): string {
  return createToken(
    secret,
    'recovery.v1',
    [userId],
    now.getTime() + RECOVERY_MAX_AGE_SECONDS * 1000,
  );
}

export function recoveryUserId(
  secret: string,
  token: string | undefined,
  now: Date,
): string | null {
  return readToken(secret, 'recovery.v1', token, 1, now)?.[0] ?? null;
}

/** Constant-time passcode check: both sides are hashed to equal-length digests first. */
export function passcodeMatches(input: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return safeEqual(digest(input), digest(expected));
}

/** AUTH-5, ACCT-10: IPs are stored only as salted (keyed) hashes. */
export function hashIp(ip: string, sessionSecret: string): string {
  return hmac(sessionSecret, `ip.v1.${ip}`).toString('hex');
}

// Strict for the login session. The claim proof is Lax because it must reach /auth/confirm when
// the owner opens the confirmation link from their email (a cross-site navigation).
const STRICT = 'Path=/; HttpOnly; Secure; SameSite=Strict';
const LAX = 'Path=/; HttpOnly; Secure; SameSite=Lax';

const COOKIES = {
  [SESSION_COOKIE]: { maxAge: SESSION_MAX_AGE_SECONDS, attributes: STRICT },
  [CLAIM_COOKIE]: { maxAge: CLAIM_MAX_AGE_SECONDS, attributes: LAX },
  [RECOVERY_COOKIE]: { maxAge: RECOVERY_MAX_AGE_SECONDS, attributes: STRICT },
} as const;

type CookieName = keyof typeof COOKIES;

export function setCookie(name: CookieName, token: string): string {
  const { maxAge, attributes } = COOKIES[name];
  return `${name}=${token}; Max-Age=${maxAge}; ${attributes}`;
}

export function clearCookie(name: CookieName): string {
  return `${name}=; Max-Age=0; ${COOKIES[name].attributes}`;
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}
