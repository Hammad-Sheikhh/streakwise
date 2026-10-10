/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

// PWA-1–3 on the production build that `vite preview` serves.

test('the app can be installed: manifest, icons, and theme color (PWA-1)', async ({
  page,
  request,
}) => {
  await page.goto('/demo');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#/);

  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    icons: { src: string }[];
  };
  expect(manifest).toMatchObject({ name: 'Streakwise', display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type']).toBe('image/png');
  }
});

test('offline, the cached app still opens and says so (PWA-2, PWA-3)', async ({
  page,
  context,
}) => {
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // The worker keeps the app shell only, never server responses.
  const cached = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const key of await caches.keys()) {
      for (const request of await (await caches.open(key)).keys()) {
        paths.push(new URL(request.url).pathname);
      }
    }
    return paths;
  });
  expect(cached).toContain('/index.html');
  expect(cached.filter((path) => /^\/(api|mcp|auth)\//.test(path))).toEqual([]);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You’re offline.')).toBeVisible();
  // The demo runs fully in the browser, so it still works offline.
  await expect(page.getByRole('region', { name: 'Streak' })).toBeVisible();
  await context.setOffline(false);
});
