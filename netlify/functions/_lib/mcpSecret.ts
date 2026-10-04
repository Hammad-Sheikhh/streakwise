import { createHash, timingSafeEqual } from 'node:crypto';

// MCP-1: the secret in the connector URL is the only credential for the Claude connection.

/** Shorter secrets are treated as not configured: the URL must be impossible to guess. */
export const MIN_MCP_SECRET_LENGTH = 32;

export function isMcpConfigured(secret: string | undefined): secret is string {
  return secret !== undefined && secret.length >= MIN_MCP_SECRET_LENGTH;
}

/** Constant-time comparison: both sides are hashed to equal-length digests first. */
export function mcpSecretMatches(given: string, expected: string | undefined): boolean {
  if (!isMcpConfigured(expected)) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
