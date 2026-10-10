// Renders the PWA icons (PWA-1) from public/favicon.svg with Playwright's Chromium.
// Run once after changing the logo: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// Maskable icons may be cropped to a circle, so the logo sits inside the middle 80% on the
// logo's own background colour.
const icons = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'maskable-512.png', size: 512, padding: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.08 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { file, size, padding } of icons) {
  const inset = Math.round(size * padding);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:${padding ? '#0f172a' : 'transparent'}">` +
      `<img src="${dataUrl}" style="display:block;margin:${inset}px;width:${size - 2 * inset}px;height:${size - 2 * inset}px"></body>`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: !padding });
}
await browser.close();
