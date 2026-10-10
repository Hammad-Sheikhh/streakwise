import type { Plugin } from 'vite';

// All response headers live here and are written to `dist/_headers` only by builds on Netlify.
// Neither netlify.toml nor a local build may carry them: `netlify dev` applies headers from both
// (it reads `dist/_headers` even with `[dev] publish` set), and the strict CSP blocks the inline
// React Refresh script Vite injects, leaving the local page blank.
// Netlify's docs recommend one source of headers, so none remain in netlify.toml.

type HeaderRule = { path: string; headers: Record<string, string> };

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
    path: '/*',
    headers: {
      'Content-Security-Policy': contentSecurityPolicy,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  },
  {
    // Shared reports are private: keep them out of search engines and never leak the slug via Referer.
    path: '/r/*',
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  },
  {
    // PWA-2: the worker and manifest must be checked on every visit, so a new release is picked up.
    path: '/sw.js',
    headers: { 'Cache-Control': 'no-cache' },
  },
  {
    // Hashed build assets never change, so browsers can cache them for a year.
    path: '/assets/*',
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  },
];

export function renderHeadersFile(rules: HeaderRule[]): string {
  return rules
    .map(
      (rule) =>
        `${rule.path}\n` +
        Object.entries(rule.headers)
          .map(([name, value]) => `  ${name}: ${value}\n`)
          .join(''),
    )
    .join('\n');
}

export function securityHeaders(): Plugin {
  return {
    name: 'streakwise-security-headers',
    // Netlify sets NETLIFY=true in its build environment.
    apply: () => process.env.NETLIFY === 'true',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: renderHeadersFile(headerRules),
      });
    },
  };
}
