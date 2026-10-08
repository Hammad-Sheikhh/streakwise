// SHARE-1: share links use at least 24 random URL-safe characters from a cryptographically secure
// generator. 24 random bytes give 32 base64url characters (192 bits), far too many to guess.

const SLUG_BYTES = 24;
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{24,64}$/;

export type SlugGenerator = () => string;

/** Uses Web Crypto, which both browsers and Node provide. */
export const newShareSlug: SlugGenerator = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(SLUG_BYTES));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
