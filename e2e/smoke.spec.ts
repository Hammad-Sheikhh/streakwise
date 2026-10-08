import { expect, test } from '@playwright/test';

// The full demo-mode journey arrives in M7 (SPEC §B13); this covers the login page, the demo entry,
// and logging a session in the demo.
test('the demo logs a session without ever calling the API', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api') || pathname.startsWith('/mcp')) apiCalls.push(pathname);
  });

  await page.goto('/demo/settings');
  await expect(page.getByText('Demo — sample data. Changes aren’t saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Exit demo' }).click();

  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByRole('link', { name: 'Try the demo' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Streakwise' })).toBeVisible();
  await page.getByRole('link', { name: 'Log your first session' }).click();
  await page
    .getByRole('combobox', { name: 'Track', exact: true })
    .selectOption({ label: 'Exam Prep' });
  await page.getByRole('button', { name: '45m' }).click();
  await page.getByRole('button', { name: 'Save session' }).click();

  await expect(page.getByText('Logged 45m · Exam Prep')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Today' })).toContainText('45m');
  await expect(page.getByRole('region', { name: 'Streak' })).toContainText('1 day');

  // M6: this week's report includes the session and can be copied as text.
  await page.getByRole('link', { name: 'This week’s report' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly study report' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Exam Prep/ }).first()).toContainText('45m');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy as text' }).click();
  await expect(page.getByText('Copied for WhatsApp.')).toBeVisible();
  expect(apiCalls).toEqual([]);
});
