// All response headers live here. On Vercel they are kept in vercel.json; this module is the
// single source they are written from, so a test can fail when vercel.json and the rules disagree
// (previously the same rules were rendered to Netlify's dist/_headers at build time).

type HeaderRule = { path: string; headers: Record<string, string> };
export type { HeaderRule };

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  // Radix and Recharts set inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const headerRules: HeaderRule[] = [
  {
    headers: {
      'Content-Security-Policy': contentSecurityPolicy,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
    path: '/*',
  },
  {
    // Shared reports are private: keep them out of search engines and never leak the slug via Referer.
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
    path: '/r/*',
  },
  {
    // PWA-2: the worker and manifest must be checked on every visit, so a new release is picked up.
    headers: { 'Cache-Control': 'no-cache' },
    path: '/sw.js',
  },
  {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' },
    path: '/manifest.webmanifest',
  },
  {
    // Hashed build assets never change, so browsers can cache them for a year.
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    path: '/assets/*',
  },
];

/** `/*` → `/(.*)`; suffixed `/*` → `/:path*` — same matches in vercel.json's path-to-regexp form. */
export function vercelSource(path: string): string {
  if (path === '/*') return '/(.*)';
  if (!path.endsWith('/*')) return path;
  return `${path.slice(0, -2)}/:path*`;
}

/** The shapes of the same rules as they appear in the `headers` array of vercel.json. */
export function vercelHeaders(): Array<{
  source: string;
  headers: Array<{ key: string; value: string }>;
}> {
  return headerRules.map((rule) => ({
    source: vercelSource(rule.path),
    headers: Object.entries(rule.headers).map(([key, value]) => ({ key, value })),
  }));
}
