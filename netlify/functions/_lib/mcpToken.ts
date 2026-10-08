import { createHash, randomBytes } from 'node:crypto';

// ACCT-8: each user's Claude link is /mcp/<token>. The token is the only credential, so it is long
// and random, and only its SHA-256 hash is stored: a database leak doesn't reveal working links.

export function generateMcpToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are 43 base64url characters; anything else can't be one. */
export function isMcpTokenShaped(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
