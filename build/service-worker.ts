import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import type { Plugin } from 'vite';

// PWA-2: writes dist/sw.js from build/sw-template.js with this build's file list, so the worker
// can cache the whole app shell and every deploy replaces the previous cache.

const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');

// Netlify-only files and source maps are never requested by the app.
const SKIPPED = [/^_headers$/, /^_redirects$/, /\.map$/, /^sw\.js$/];

export function precacheUrls(fileNames: readonly string[]): string[] {
  return fileNames
    .filter((name) => !SKIPPED.some((pattern) => pattern.test(name)))
    .map((name) => `/${name}`)
    .sort();
}

export function renderServiceWorker(urls: readonly string[]): string {
  const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
  return template
    .replace("'__SW_VERSION__'", JSON.stringify(version))
    .replace('__PRECACHE_URLS__', JSON.stringify(urls));
}

export function serviceWorker(): Plugin {
  let publicFiles: string[] = [];
  return {
    name: 'streakwise-service-worker',
    apply: 'build',
    // After Vite's own plugins, so index.html is already in the bundle.
    enforce: 'post',
    configResolved(config) {
      // Files in public/ (icons, the manifest) are copied as they are, outside the bundle.
      const dir = config.publicDir;
      publicFiles = dir
        ? readdirSync(dir, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
        : [];
    },
    generateBundle(_options, bundle) {
      const urls = precacheUrls([...Object.keys(bundle), ...publicFiles]);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker(urls) });
    },
  };
}
