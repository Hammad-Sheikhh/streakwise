import { expect, test } from '@playwright/test';

// The full demo-mode journey arrives in M7 (SPEC §B13); this covers the login page and the demo entry.
test('the login page leads into the demo, which never calls the API', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api') || pathname.startsWith('/mcp')) apiCalls.push(pathname);
  });

  await page.goto('/demo');
  await expect(page.getByText('Demo — sample data. Changes aren’t saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Exit demo' }).click();

  await expect(page.getByLabel('Passcode')).toBeVisible();
  await page.getByRole('link', { name: 'Try the demo' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Streakwise' })).toBeVisible();
  await expect(page.getByText('German Language')).toBeVisible();
  expect(apiCalls).toEqual([]);
});
