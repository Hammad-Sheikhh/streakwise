// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { precacheUrls, renderServiceWorker } from './service-worker';

describe('service worker (PWA-2)', () => {
  it('caches the built files and public files, but not Netlify files, maps, or itself', () => {
    expect(
      precacheUrls([
        'index.html',
        'assets/index-abc.js',
        'assets/index-abc.js.map',
        '_headers',
        'sw.js',
        'icons/icon-192.png',
      ]),
    ).toEqual(['/assets/index-abc.js', '/icons/icon-192.png', '/index.html']);
  });

  it('fills in the file list and a version that changes with the files', () => {
    const a = renderServiceWorker(['/index.html', '/assets/a.js']);
    const b = renderServiceWorker(['/index.html', '/assets/b.js']);
    expect(a).toContain('const PRECACHE_URLS = ["/index.html","/assets/a.js"];');
    expect(a).not.toContain('__SW_VERSION__');
    expect(a).not.toContain('__PRECACHE_URLS__');
    expect(a.match(/const VERSION = "([0-9a-f]{12})"/)?.[1]).not.toBe(
      b.match(/const VERSION = "([0-9a-f]{12})"/)?.[1],
    );
  });

  it('never handles data, Claude, or sign-in requests', () => {
    const source = renderServiceWorker([]);
    expect(source).toContain("const NEVER_CACHED = ['/api/', '/mcp/', '/auth/', '/.well-known/'];");
    expect(source).toContain(
      'if (NEVER_CACHED.some((prefix) => url.pathname.startsWith(prefix))) return;',
    );
  });
});
