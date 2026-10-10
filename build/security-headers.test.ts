// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { headerRules, renderHeadersFile, securityHeaders } from './security-headers';

describe('securityHeaders plugin', () => {
  afterEach(() => vi.unstubAllEnvs());

  // A local `dist/_headers` would be picked up by `netlify dev` and blank the local page.
  it('runs only in builds on Netlify', () => {
    const { apply } = securityHeaders();
    if (typeof apply !== 'function') throw new Error('apply should be a function');
    const args = [{}, { command: 'build', mode: 'production' }] as Parameters<typeof apply>;

    vi.stubEnv('NETLIFY', '');
    expect(apply(...args)).toBe(false);
    vi.stubEnv('NETLIFY', 'true');
    expect(apply(...args)).toBe(true);
  });
});

describe('security headers', () => {
  const file = renderHeadersFile(headerRules);

  it('renders Netlify _headers syntax: a path line, then indented "Name: value" lines', () => {
    expect(renderHeadersFile([{ path: '/x/*', headers: { A: '1', B: '2' } }])).toBe(
      '/x/*\n  A: 1\n  B: 2\n',
    );
  });

  it('keeps scripts limited to our own files on every page', () => {
    expect(file).toMatch(/^\/\*\n {2}Content-Security-Policy: [^\n]*script-src 'self';/);
    expect(file).not.toContain("'unsafe-eval'");
  });

  it('keeps shared reports out of search engines (SHARE-2)', () => {
    expect(file).toContain('/r/*\n  X-Robots-Tag: noindex, nofollow\n');
  });

  it('serves the PWA files fresh and with the right type (PWA-1/2)', () => {
    expect(file).toContain('/sw.js
  Cache-Control: no-cache
');
    expect(file).toContain('/manifest.webmanifest
  Content-Type: application/manifest+json
');
  });
});
