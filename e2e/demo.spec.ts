import { expect, test } from '@playwright/test';

import { openScreen, watchServerCalls } from './helpers';

// SPEC §B13: the demo journey, on sample data (DEMO-3), without a single request to /api or /mcp.

test('the full demo journey works without ever calling the server', async ({ page }) => {
  const serverCalls = watchServerCalls(page);

  // Starts on the login page: `/` would first ask the server whether someone is logged in.
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByRole('link', { name: 'Try the demo' }).click();

  // DEMO-4 banner and DEMO-3 sample data: a streak, and Science left untouched.
  await expect(page.getByText('Demo — sample data. Changes aren’t saved.')).toBeVisible();
  const streak = page.getByRole('region', { name: 'Streak' });
  await expect(streak).toContainText(/\d+ days/);
  const daysBefore = Number((await streak.textContent())?.match(/(\d+) days/)?.[1]);
  await expect(page.getByRole('region', { name: 'Today' })).toContainText('0m');

  // NEG-1: the neglect warning opens Log with Science chosen.
  await page.getByRole('link', { name: /^Science — \d+ days untouched/ }).click();
  await expect(page.getByRole('button', { name: 'Save session' })).toBeVisible();
  await page.getByRole('button', { name: '45m', exact: true }).click();
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText(/Logged 45m/)).toBeVisible();

  // Home: today's time, a longer streak, and no more warning.
  await expect(page.getByRole('region', { name: 'Today' })).toContainText('45m');
  await expect(streak).toContainText(`${daysBefore + 1} days`);
  await expect(page.getByRole('region', { name: 'Needs attention' })).toHaveCount(0);

  // History shows it under Today.
  await openScreen(page, 'History');
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today).toContainText('Science');
  await expect(today).toContainText('45m');

  // TASK-6: complete this week's scored self-test with a score.
  await openScreen(page, 'Tasks');
  const selfTest = page.getByRole('checkbox', { name: 'Weekly self-test (this week)' });
  await selfTest.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Score').fill('19');
  await dialog.getByRole('button', { name: 'Save and complete' }).click();
  await expect(selfTest).toBeChecked();

  // REP-1/4: this week's report includes the session and can be copied as text.
  await openScreen(page, 'Reports');
  await expect(page.getByRole('heading', { name: 'Weekly study report' })).toBeVisible();
  await expect(page.getByText('Demo Student').first()).toBeVisible();
  await expect(page.getByRole('row', { name: /School Subjects/ }).first()).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy as text' }).click();
  await expect(page.getByText('Copied for WhatsApp.')).toBeVisible();

  expect(serverCalls).toEqual([]);
});

test('share links and the Claude connection are off in the demo (DEMO-5)', async ({ page }) => {
  const serverCalls = watchServerCalls(page);
  await page.goto('/demo');

  await openScreen(page, 'Reports');
  await expect(
    page.getByText(
      'Share links are off in the demo, because demo data lives only in this browser.',
    ),
  ).toBeVisible();

  await openScreen(page, 'Settings');
  await expect(page.getByText(/^Not available in the demo/)).toBeVisible();

  await page.getByRole('button', { name: 'Exit demo' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  expect(serverCalls).toEqual([]);
});
