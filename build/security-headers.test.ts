// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { headerRules, vercelHeaders, vercelSource } from './security-headers';

describe('security header sources', () => {
  it('converts Netlify-style paths to vercel.json path patterns', () => {
    expect(vercelSource('/*')).toBe('/(.*)');
    expect(vercelSource('/r/*')).toBe('/r/:path*');
    expect(vercelSource('/assets/*')).toBe('/assets/:path*');
    expect(vercelSource('/sw.js')).toBe('/sw.js');
  });
});

describe('vercel.json headers', () => {
  const config = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };

  it('matches the rules in build/security-headers.ts exactly', () => {
    expect(config.headers).toEqual(vercelHeaders());
  });

  it('keeps scripts limited to our own files on every page', () => {
    const csp = config.headers[0]?.headers.find(
      (header) => header.key === 'Content-Security-Policy',
    )?.value;
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });

  it('keeps shared reports out of search engines (SHARE-2)', () => {
    const robots = config.headers.find((rule) => rule.source === '/r/:path*');
    expect(
      robots?.headers.some((h) => h.key === 'X-Robots-Tag' && h.value === 'noindex, nofollow'),
    ).toBe(true);
  });

  it('serves the PWA files fresh and with the right type (PWA-1/2)', () => {
    const manifest = config.headers.find((rule) => rule.source === '/manifest.webmanifest');
    expect(manifest?.headers.some((h) => h.key === 'Content-Type')).toBe(true);
    const sw = config.headers.find((rule) => rule.source === '/sw.js');
    expect(sw?.headers.some((h) => h.key === 'Cache-Control' && h.value === 'no-cache')).toBe(true);
  });
});

describe('header rules', () => {
  it('cover every path exactly once, plus a catch-all first', () => {
    expect(headerRules[0]?.path).toBe('/*');
    expect(new Set(headerRules.map((r) => r.path)).size).toBe(headerRules.length);
  });
});
