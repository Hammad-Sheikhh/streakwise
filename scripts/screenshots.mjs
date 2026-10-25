// Regenerates the screenshots in docs/screenshots/ from the demo, on sample data.
// Usage: npm run build && npm run preview -- --port 4173 & npm run screenshots
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = 'docs/screenshots';

const DESKTOP = { width: 1440, height: 960 };
const PHONE = { width: 390, height: 844 };

/** Opens a screen through the navigation; reloading would reset the demo data. */
async function openScreen(page, name) {
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  const link = nav.getByRole('link', { name, exact: true });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await nav.getByRole('link', { name: 'More', exact: true }).click();
  await page.getByRole('main').getByRole('link', { name, exact: true }).click();
}

const SHOTS = [
  { file: 'home-desktop-light', size: DESKTOP, scheme: 'light', open: () => {} },
  { file: 'home-phone-light', size: PHONE, scheme: 'light', open: () => {} },
  {
    file: 'log-phone-light',
    size: PHONE,
    scheme: 'light',
    open: (page) => openScreen(page, 'Log'),
  },
  {
    file: 'track-desktop-light',
    size: DESKTOP,
    scheme: 'light',
    open: async (page) => {
      await openScreen(page, 'Tracks');
      await page.getByRole('link', { name: /School Subjects/ }).click();
    },
  },
  {
    file: 'reports-desktop-light',
    size: DESKTOP,
    scheme: 'light',
    open: (page) => openScreen(page, 'Reports'),
  },
  { file: 'home-desktop-dark', size: DESKTOP, scheme: 'dark', open: () => {} },
  {
    file: 'tasks-phone-dark',
    size: PHONE,
    scheme: 'dark',
    open: (page) => openScreen(page, 'Tasks'),
  },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: shot.size,
    colorScheme: shot.scheme,
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/demo`);
  await page.getByText('Demo — sample data. Changes aren’t saved.').waitFor();
  await shot.open(page);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${shot.file}.png` });
  console.log(`saved ${OUT}/${shot.file}.png`);
  await context.close();
}

await browser.close();
